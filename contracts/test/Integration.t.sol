// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {ProvenanceRegistry} from "../src/ProvenanceRegistry.sol";
import {DreamScheme} from "../src/DreamScheme.sol";
import {SchemeMarket} from "../src/SchemeMarket.sol";
import {P256PasskeyAccount} from "../src/P256PasskeyAccount.sol";
import {Fixtures} from "./utils/Fixtures.t.sol";

/// @dev Fixed-challenge account (same as in P256PasskeyAccount.t.sol), used for offline pre-signed end-to-end flows.
contract FixedChallengeAccount is P256PasskeyAccount {
    bytes32 public immutable fixedBase;

    constructor(uint256 x, uint256 y, bytes32 rpIdHash_, bytes32 originHash_, bytes32 fixedBase_)
        P256PasskeyAccount(x, y, rpIdHash_, originHash_)
    {
        fixedBase = fixedBase_;
    }

    function _challengeSingle(uint256 n, address, uint256, bytes32) internal view override returns (bytes32) {
        return sha256(abi.encodePacked(fixedBase, uint8(1), n));
    }

    function _challengeBatch(uint256 n, bytes32) internal view override returns (bytes32) {
        return sha256(abi.encodePacked(fixedBase, uint8(2), n));
    }
}

/// @title IntegrationTest — end-to-end main story
/// @notice A passkey user atomically completes attestation + mint with a single Face ID;
///         an EOA user gets a gasless attestation via the EIP-712 relayer;
///         after a derivative scheme is sold, the split follows the lineage automatically.
contract IntegrationTest is Fixtures {
    AgentRegistry internal agents;
    ProvenanceRegistry internal provenance;
    DreamScheme internal scheme;
    SchemeMarket internal market;
    FixedChallengeAccount internal alice;

    address internal platform = makeAddr("platform");
    address internal bob;
    address internal carol = makeAddr("carol");
    uint256 internal constant BOB_PK = 0xB0B;
    uint256 internal kimiId;

    function setUp() public override {
        super.setUp();

        // -- same deployment order as Deploy.s.sol --
        agents = new AgentRegistry(address(this));
        provenance = new ProvenanceRegistry(agents);
        agents.setProvenanceRegistry(address(provenance));
        scheme = new DreamScheme(agents);
        market = new SchemeMarket(scheme, payable(platform));

        // Pre-register Kimi (agentId = 1)
        kimiId = agents.registerAgent("https://designerhub.xyz/agents/kimi.json");
        assertEq(kimiId, 1);

        // Alice: passkey smart account (key1), funded with ETH for the demo
        (uint256 x1, uint256 y1) = _fxKey(0);
        bytes32 base = _fxBytes32(".challenge");
        alice = new FixedChallengeAccount(x1, y1, fxRpIdHash, fxOriginHash, base);
        deal(address(alice), 1 ether);

        bob = vm.addr(BOB_PK);
        deal(carol, 1 ether);
    }

    /// Main story: import scheme -> one Face ID atomically does "attest + mint" -> remixed -> sold -> lineage split.
    function test_FullUserJourney() public {
        bytes32 contentHash = keccak256("alice-plan-json");
        bytes32 salt = bytes32(uint256(0x5A17));
        bytes32 commitment = keccak256(abi.encodePacked(contentHash, salt));

        // -- 1. Alice, one Face ID: executeBatch atomically does attest + mint -- //
        address[] memory to = new address[](2);
        uint256[] memory value = new uint256[](2);
        bytes[] memory data = new bytes[](2);
        to[0] = address(provenance);
        data[0] = abi.encodeCall(ProvenanceRegistry.attest, (commitment, kimiId, "ipfs://meta"));
        to[1] = address(scheme);
        data[1] = abi.encodeCall(DreamScheme.mint, (0, contentHash, kimiId, "ipfs://alice"));

        alice.executeBatch(to, value, data, _fxAssertion("key1_batch_n0"));
        assertEq(alice.nonce(), 1, "one FaceID = one nonce");

        // Attestation recorded
        (bool exists, address attestor, uint256 agentId,) = provenance.verify(commitment);
        assertTrue(exists);
        assertEq(attestor, address(alice));
        assertEq(agentId, kimiId);

        // Mint recorded + attribution
        assertEq(scheme.ownerOf(1), address(alice));
        assertEq(scheme.creatorOf(1), address(alice));
        assertEq(scheme.agentIdOf(1), kimiId);

        // Kimi reputation +1 (attestation-driven, not manual)
        assertEq(agents.reputationOf(kimiId), 1);

        // -- 2. Bob (EOA) remixes Alice's scheme -- //
        vm.prank(bob);
        uint256 bobTokenId = scheme.remix(1, keccak256("bob-remix"), kimiId, "ipfs://bob-remix");
        assertEq(bobTokenId, 2);

        uint256[] memory lineage = scheme.lineageOf(2);
        assertEq(lineage.length, 2);
        assertEq(lineage[0], 1);
        assertEq(lineage[1], 2);

        // -- 3. Bob gets a gasless attestation of his derivative via the EIP-712 relayer -- //
        bytes32 bobCommitment = keccak256(abi.encodePacked(keccak256("bob-remix"), bytes32(uint256(0xB0B5))));
        ProvenanceRegistry.AttestRequest memory req = ProvenanceRegistry.AttestRequest({
            attestor: bob,
            commitment: bobCommitment,
            agentId: kimiId,
            metadataURI: "",
            nonce: 0,
            deadline: block.timestamp + 1 hours
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(BOB_PK, provenance.attestRequestDigest(req));
        // relayer (this test contract) submits and pays
        provenance.attestByRelayer(req, abi.encodePacked(r, s, v));

        (bool bobExists, address bobAttestor, uint256 bobAgentId,) = provenance.verify(bobCommitment);
        assertTrue(bobExists);
        assertEq(bobAttestor, bob);
        assertEq(bobAgentId, kimiId);
        assertEq(provenance.nonces(bob), 1);

        // -- 4. Bob lists the derivative, Carol buys the usage rights -- //
        vm.prank(bob);
        market.setPrice(2, 0.1 ether);

        uint256 bobBalBefore = bob.balance;
        vm.prank(carol);
        market.applyScheme{value: 0.1 ether}(2);

        // Lineage split: Bob 85% / Alice 5% / platform 10%
        assertEq(bob.balance - bobBalBefore, 0.085 ether);
        assertEq(address(alice).balance, 1 ether + 0.005 ether);
        assertEq(platform.balance, 0.01 ether);
        assertEq(carol.balance, 0.9 ether, unicode"conservation: 0.085 + 0.005 + 0.01 = 0.1");

        assertEq(market.appliedCount(2), 1);
        assertEq(market.totalApplied(), 1);

        // Kimi reputation = 2 (Alice's attestation + Bob's gasless attestation)
        assertEq(agents.reputationOf(kimiId), 2);
    }

    /// Verifier's view: anyone can recompute the commitment locally from raw content + salt and check it against the on-chain record.
    function test_VerificationTool_UnattestedCommitment() public view {
        bytes32 contentHash = keccak256("some-plan");
        bytes32 salt = bytes32(uint256(0x51));
        bytes32 commitment = keccak256(abi.encodePacked(contentHash, salt));

        (bool e, address a, uint256 ag,) = provenance.verify(commitment);
        assertFalse(e);
        assertEq(a, address(0));
        assertEq(ag, 0);
    }
}
