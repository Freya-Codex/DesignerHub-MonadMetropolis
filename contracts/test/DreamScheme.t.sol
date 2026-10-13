// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {DreamScheme} from "../src/DreamScheme.sol";

/// @title DreamSchemeTest — scheme minting / lineage / royalties
contract DreamSchemeTest is Test {
    AgentRegistry internal agents;
    DreamScheme internal scheme;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    uint256 internal kimiId;

    function setUp() public {
        agents = new AgentRegistry(address(this));
        scheme = new DreamScheme(agents);
        kimiId = agents.registerAgent("ipfs://kimi");
    }

    // -------------------------------- Mint -------------------------------- //

    function test_Mint_Original() public {
        bytes32 contentHash = keccak256("plan-a");
        vm.prank(alice);
        uint256 id = scheme.mint(0, contentHash, kimiId, "ipfs://a");

        assertEq(id, 1);
        assertEq(scheme.ownerOf(1), alice);
        assertEq(scheme.totalSupply(), 1);

        DreamScheme.Scheme memory s = scheme.schemeOf(1);
        assertEq(s.creator, alice);
        assertEq(s.parentId, 0);
        assertEq(s.contentHash, contentHash);
        assertEq(s.agentId, kimiId);

        assertEq(scheme.tokenURI(1), "ipfs://a");
        assertEq(scheme.hashToTokenId(contentHash), 1);
        assertEq(scheme.remixCount(1), 0);
        assertGt(scheme.createdAtOf(1), 0);

        // Setting the default 5% royalty at mint (ERC-2981)
        (address receiver, uint256 amount) = scheme.royaltyInfo(1, 1 ether);
        assertEq(receiver, alice);
        assertEq(amount, 0.05 ether);
    }

    function test_Mint_ZeroContentHashRejected() public {
        vm.prank(alice);
        vm.expectRevert(DreamScheme.InvalidContentHash.selector);
        scheme.mint(0, bytes32(0), 0, "ipfs://a");
    }

    function test_Mint_EmptyURIRejected() public {
        vm.prank(alice);
        vm.expectRevert(DreamScheme.EmptyTokenURI.selector);
        scheme.mint(0, keccak256("h"), 0, "");
    }

    function test_Mint_UnregisteredAgentRejected() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DreamScheme.AgentNotRegistered.selector, 99));
        scheme.mint(0, keccak256("h"), 99, "ipfs://a");
    }

    function test_Mint_UnmintedParentRejected() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DreamScheme.ParentSchemeNotMinted.selector, 99));
        scheme.mint(99, keccak256("h"), 0, "ipfs://a");
    }

    // ------------------------------- remix -------------------------------- //

    function test_Remix_LineageAndChildren() public {
        vm.prank(alice);
        scheme.mint(0, keccak256("a"), kimiId, "ipfs://a");
        vm.prank(bob);
        uint256 id2 = scheme.remix(1, keccak256("b"), kimiId, "ipfs://b");

        assertEq(id2, 2);
        assertEq(scheme.ownerOf(2), bob);

        DreamScheme.Scheme memory s = scheme.schemeOf(2);
        assertEq(s.creator, bob);
        assertEq(s.parentId, 1);

        uint256[] memory children = scheme.childrenOf(1);
        assertEq(children.length, 1);
        assertEq(children[0], 2);
        assertEq(scheme.remixCount(1), 1);

        uint256[] memory lineage = scheme.lineageOf(2);
        assertEq(lineage.length, 2);
        assertEq(lineage[0], 1);
        assertEq(lineage[1], 2);

        uint256[] memory rootLineage = scheme.lineageOf(1);
        assertEq(rootLineage.length, 1);
        assertEq(rootLineage[0], 1);
    }

    function test_Remix_ZeroParentRejected() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DreamScheme.ParentSchemeNotMinted.selector, 0));
        scheme.remix(0, keccak256("h"), 0, "ipfs://a");
    }

    function test_Remix_UnmintedParentRejected() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DreamScheme.ParentSchemeNotMinted.selector, 99));
        scheme.remix(99, keccak256("h"), 0, "ipfs://a");
    }

    function test_Lineage_DeepChain() public {
        // 1 ← 2 ← 3 ← 4
        for (uint256 i = 1; i <= 4; i++) {
            vm.prank(alice);
            scheme.mint(i - 1, keccak256(abi.encodePacked("plan", i)), 0, "ipfs://x");
        }
        uint256[] memory lineage = scheme.lineageOf(4);
        assertEq(lineage.length, 4);
        for (uint256 i = 0; i < 4; i++) {
            assertEq(lineage[i], i + 1);
        }
    }

    // ------------------------------ Royalty -------------------------------- //

    function test_SetRoyalty_Bounds() public {
        vm.prank(alice);
        scheme.mint(0, keccak256("a"), 0, "ipfs://a");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DreamScheme.RoyaltyOutOfBounds.selector, 499));
        scheme.setRoyalty(1, 499);

        vm.prank(alice);
        scheme.setRoyalty(1, 500);
        (, uint256 amount) = scheme.royaltyInfo(1, 1 ether);
        assertEq(amount, 0.05 ether);

        vm.prank(alice);
        scheme.setRoyalty(1, 1_000);
        (, amount) = scheme.royaltyInfo(1, 1 ether);
        assertEq(amount, 0.1 ether);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DreamScheme.RoyaltyOutOfBounds.selector, 1_001));
        scheme.setRoyalty(1, 1_001);
    }

    function test_SetRoyalty_OnlyCreator() public {
        vm.prank(alice);
        scheme.mint(0, keccak256("a"), 0, "ipfs://a");
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(DreamScheme.NotCreator.selector, bob, 1));
        scheme.setRoyalty(1, 800);
    }

    function test_SetRoyalty_UnmintedRejected() public {
        vm.expectRevert(abi.encodeWithSelector(DreamScheme.SchemeNotMinted.selector, 99));
        scheme.setRoyalty(99, 500);
    }

    // ------------------------ Attribution stability ------------------------ //

    function test_CreatorStableAfterTransfer() public {
        vm.prank(alice);
        scheme.mint(0, keccak256("a"), 0, "ipfs://a");
        vm.prank(alice);
        scheme.transferFrom(alice, bob, 1);

        assertEq(scheme.ownerOf(1), bob);
        assertEq(scheme.creatorOf(1), alice); // attribution and split beneficiary do not change when the NFT is transferred

        (address receiver,) = scheme.royaltyInfo(1, 1 ether);
        assertEq(receiver, alice);
    }

    // ---------------------------- Version chain ---------------------------- //

    function test_VersionLine_SameAuthorChain() public {
        // alice: 1 <- 2 <- 3; bob: 4 remixed from 1
        for (uint256 i = 1; i <= 3; i++) {
            vm.prank(alice);
            scheme.mint(i - 1, keccak256(abi.encodePacked("v", i)), 0, "ipfs://v");
        }
        vm.prank(bob);
        scheme.remix(1, keccak256("b"), 0, "ipfs://b");

        uint256[] memory expected = new uint256[](3);
        expected[0] = 1;
        expected[1] = 2;
        expected[2] = 3;
        assertEq(scheme.versionLineOf(1), expected);
        assertEq(scheme.versionLineOf(3), expected);

        uint256[] memory bobOnly = new uint256[](1);
        bobOnly[0] = 4;
        assertEq(scheme.versionLineOf(4), bobOnly);
    }

    // ------------------------------ Queries -------------------------------- //

    function test_SchemeOf_UnmintedReverts() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 99));
        scheme.schemeOf(99);
    }

    function test_SupportsInterfaces() public view {
        assertTrue(scheme.supportsInterface(type(IERC721).interfaceId)); // 0x80ac58cd
        assertTrue(scheme.supportsInterface(type(IERC2981).interfaceId)); // 0x2a55205a
    }
}
