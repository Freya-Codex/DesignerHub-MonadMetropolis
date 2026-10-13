// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {ProvenanceRegistry} from "../src/ProvenanceRegistry.sol";

/// @title ProvenanceRegistryTest — attestation registry + EIP-712 relayer payment
contract ProvenanceRegistryTest is Test {
    AgentRegistry internal agents;
    ProvenanceRegistry internal provenance;

    uint256 internal constant ALICE_PK = 0xA11CE;
    uint256 internal constant BOB_PK = 0xB0B;
    address internal alice;
    address internal bob;

    bytes32 internal constant ATTEST_TYPEHASH = keccak256(
        "AttestRequest(address attestor,bytes32 commitment,uint256 agentId,string metadataURI,uint256 nonce,uint256 deadline)"
    );

    function setUp() public {
        agents = new AgentRegistry(address(this));
        provenance = new ProvenanceRegistry(agents);
        agents.setProvenanceRegistry(address(provenance));
        vm.prank(address(0xA9E9C));
        agents.registerAgent("ipfs://kimi"); // agentId = 1

        alice = vm.addr(ALICE_PK);
        bob = vm.addr(BOB_PK);
    }

    // ------------------------------- attest ------------------------------- //

    function test_Attest_RecordsAttestation() public {
        bytes32 commitment = keccak256("commitment-1");
        vm.prank(alice);
        provenance.attest(commitment, 1, "ipfs://meta");

        (bool exists, address attestor, uint256 agentId, uint64 attestedAt) = provenance.verify(commitment);
        assertTrue(exists);
        assertEq(attestor, alice);
        assertEq(agentId, 1);
        assertGt(attestedAt, 0);

        assertEq(agents.reputationOf(1), 1);
    }

    function test_Attest_NoAgentAttribution() public {
        bytes32 commitment = keccak256("human-made");
        vm.prank(alice);
        provenance.attest(commitment, 0, "");
        (bool exists, address attestor, uint256 agentId,) = provenance.verify(commitment);
        assertTrue(exists);
        assertEq(attestor, alice);
        assertEq(agentId, 0);
    }

    function test_Attest_DuplicateRejected() public {
        bytes32 commitment = keccak256("commitment-1");
        vm.prank(alice);
        provenance.attest(commitment, 1, "");
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.AlreadyAttested.selector, commitment));
        provenance.attest(commitment, 1, "");
    }

    function test_Attest_UnregisteredAgentRejected() public {
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.AgentNotRegistered.selector, 99));
        provenance.attest(keccak256("c"), 99, "");
    }

    // --------------------------- attestByRelayer -------------------------- //

    function _request(bytes32 commitment, uint256 nonce, uint256 deadline)
        internal
        view
        returns (ProvenanceRegistry.AttestRequest memory)
    {
        return ProvenanceRegistry.AttestRequest({
            attestor: alice,
            commitment: commitment,
            agentId: 1,
            metadataURI: "ipfs://meta",
            nonce: nonce,
            deadline: deadline
        });
    }

    function _signed(ProvenanceRegistry.AttestRequest memory req, uint256 pk) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, provenance.attestRequestDigest(req));
        return abi.encodePacked(r, s, v);
    }

    function test_AttestByRelayer_GaslessAttestation() public {
        ProvenanceRegistry.AttestRequest memory req = _request(keccak256("c-relay"), 0, block.timestamp + 1 hours);
        bytes memory sig = _signed(req, ALICE_PK); // sign first (contains an external view call; avoids swallowing prank/expectRevert)

        // EIP-712 encoding correctness: manually recompute the digest and match the contract
        bytes32 manualDigest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                provenance.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        ATTEST_TYPEHASH,
                        req.attestor,
                        req.commitment,
                        req.agentId,
                        keccak256(bytes(req.metadataURI)),
                        req.nonce,
                        req.deadline
                    )
                )
            )
        );
        assertEq(provenance.attestRequestDigest(req), manualDigest);

        // the relayer (bob) submits; the attestor is alice
        vm.prank(bob);
        provenance.attestByRelayer(req, sig);

        (bool exists, address attestor, uint256 agentId,) = provenance.verify(keccak256("c-relay"));
        assertTrue(exists);
        assertEq(attestor, alice);
        assertEq(agentId, 1);
        assertEq(provenance.nonces(alice), 1);
        assertEq(agents.reputationOf(1), 1);
    }

    function test_AttestByRelayer_ReplayRejected() public {
        ProvenanceRegistry.AttestRequest memory req = _request(keccak256("c-relay"), 0, block.timestamp + 1 hours);
        bytes memory sig = _signed(req, ALICE_PK);
        provenance.attestByRelayer(req, sig);

        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.BadNonce.selector, 0, 1));
        provenance.attestByRelayer(req, sig);
    }

    function test_AttestByRelayer_NonceSkipRejected() public {
        ProvenanceRegistry.AttestRequest memory req = _request(keccak256("c-relay"), 5, block.timestamp + 1 hours);
        bytes memory sig = _signed(req, ALICE_PK);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.BadNonce.selector, 5, 0));
        provenance.attestByRelayer(req, sig);
    }

    function test_AttestByRelayer_ExpiredRejected() public {
        uint256 deadline = block.timestamp + 1 hours;
        ProvenanceRegistry.AttestRequest memory req = _request(keccak256("c-relay"), 0, deadline);
        bytes memory sig = _signed(req, ALICE_PK);
        vm.warp(deadline + 1);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.Expired.selector, deadline));
        provenance.attestByRelayer(req, sig);
    }

    function test_AttestByRelayer_WrongSignerRejected() public {
        ProvenanceRegistry.AttestRequest memory req = _request(keccak256("c-relay"), 0, block.timestamp + 1 hours);
        bytes memory sig = _signed(req, BOB_PK); // bob forges alice's request signature
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.InvalidSigner.selector, bob, alice));
        provenance.attestByRelayer(req, sig);
    }

    function test_AttestByRelayer_TamperedRequestRejected() public {
        // alice signs c1, the relayer tampers it to c2 and submits -> digest mismatch
        bytes memory sig = _signed(_request(keccak256("c1"), 0, block.timestamp + 1 hours), ALICE_PK);
        ProvenanceRegistry.AttestRequest memory tampered = _request(keccak256("c2"), 0, block.timestamp + 1 hours);

        // Exact expected recovered address
        address recovered = ECDSA.recover(provenance.attestRequestDigest(tampered), sig);
        vm.expectRevert(abi.encodeWithSelector(ProvenanceRegistry.InvalidSigner.selector, recovered, alice));
        provenance.attestByRelayer(tampered, sig);
    }
}
