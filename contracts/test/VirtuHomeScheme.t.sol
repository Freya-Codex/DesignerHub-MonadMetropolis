// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {VirtuHomeScheme} from "../src/VirtuHomeScheme.sol";

/// @notice VirtuHomeScheme 铸造与 remix 谱系的单元测试。
contract VirtuHomeSchemeTest is Test {
    VirtuHomeScheme internal scheme;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal royaltyReceiver = makeAddr("royalty");

    bytes32 internal constant HASH_1 = keccak256("scheme-nordic-living-room");
    bytes32 internal constant HASH_2 = keccak256("scheme-japanese-bedroom");
    bytes32 internal constant HASH_3 = keccak256("scheme-industrial-study");

    string internal constant URI_1 = "ipfs://QmSchemeOne";
    string internal constant URI_2 = "ipfs://QmSchemeTwo";
    string internal constant URI_3 = "ipfs://QmSchemeThree";

    function setUp() public {
        vm.prank(owner);
        scheme = new VirtuHomeScheme(owner, royaltyReceiver);
    }

    function test_MintOriginal_RecordsCreatorParentAndHash() public {
        vm.expectEmit(true, true, true, true, address(scheme));
        emit VirtuHomeScheme.SchemeMinted(1, alice, 0, HASH_1);

        vm.prank(alice);
        uint256 tokenId = scheme.mint(0, HASH_1, URI_1);

        assertEq(tokenId, 1, "first tokenId should be 1");
        assertEq(scheme.ownerOf(1), alice);
        assertEq(scheme.creatorOf(1), alice, "creator recorded");
        assertEq(scheme.parentOf(1), 0, "original scheme has parentId 0");
        assertEq(scheme.contentHashOf(1), HASH_1);
        assertEq(scheme.hashToTokenId(HASH_1), 1, "hash -> tokenId index");
        assertEq(scheme.totalSupply(), 1);
        assertEq(scheme.tokenURI(1), URI_1);
        uint256[] memory children = scheme.childrenOf(1);
        assertEq(children.length, 0, "original scheme has no children");
        assertEq(scheme.remixCount(1), 0);
        assertGt(scheme.createdAtOf(1), 0);
    }

    function test_Mint_OpenToAnyone_AndTokenIdsIncrement() public {
        vm.prank(alice);
        assertEq(scheme.mint(0, HASH_1, URI_1), 1);
        vm.prank(bob);
        assertEq(scheme.mint(0, HASH_2, URI_2), 2);
        vm.prank(bob);
        assertEq(scheme.mint(2, HASH_3, URI_3), 3, "remix keeps incrementing tokenId");
        assertEq(scheme.totalSupply(), 3);
    }

    function test_Remix_BuildsLineageChain() public {
        vm.prank(alice);
        scheme.mint(0, HASH_1, URI_1); // 1: 原创
        vm.prank(bob);
        scheme.mint(1, HASH_2, URI_2); // 2: remix of 1
        vm.prank(alice);
        scheme.mint(2, HASH_3, URI_3); // 3: remix of 2

        assertEq(scheme.parentOf(2), 1);
        assertEq(scheme.parentOf(3), 2);

        uint256[] memory childrenOfOne = scheme.childrenOf(1);
        assertEq(childrenOfOne.length, 1);
        assertEq(childrenOfOne[0], 2);

        assertEq(scheme.remixCount(1), 1);
        assertEq(scheme.remixCount(2), 1);
        assertEq(scheme.remixCount(3), 0);

        uint256[] memory lineage = scheme.lineageOf(3);
        assertEq(lineage.length, 3, "lineage includes self");
        assertEq(lineage[0], 1, "root first");
        assertEq(lineage[1], 2);
        assertEq(lineage[2], 3, "self last");
    }

    function test_Remix_TwoBranchesAreBothAttributed() public {
        vm.prank(alice);
        scheme.mint(0, HASH_1, URI_1);
        vm.prank(bob);
        scheme.mint(1, HASH_2, URI_2);
        vm.prank(bob);
        scheme.mint(1, HASH_3, URI_3);

        assertEq(scheme.remixCount(1), 2);
        uint256[] memory children = scheme.childrenOf(1);
        assertEq(children[0], 2);
        assertEq(children[1], 3);
        assertEq(scheme.lineageOf(2)[0], 1);
        assertEq(scheme.lineageOf(3)[0], 1);
    }

    function test_RevertWhen_RemixParentNotMinted() public {
        vm.expectRevert(abi.encodeWithSelector(VirtuHomeScheme.ParentSchemeNotMinted.selector, 42));
        vm.prank(alice);
        scheme.mint(42, HASH_1, URI_1);
    }

    function test_RevertWhen_RemixHelperUsedWithZeroParent() public {
        vm.expectRevert(abi.encodeWithSelector(VirtuHomeScheme.ParentSchemeNotMinted.selector, 0));
        vm.prank(alice);
        scheme.remix(0, HASH_1, URI_1);
    }

    function test_RemixHelper_MintsChildScheme() public {
        vm.prank(alice);
        scheme.mint(0, HASH_1, URI_1);
        vm.prank(bob);
        uint256 tokenId = scheme.remix(1, HASH_2, URI_2);
        assertEq(tokenId, 2);
        assertEq(scheme.parentOf(2), 1);
        assertEq(scheme.creatorOf(2), bob);
    }

    function test_RevertWhen_ContentHashEmpty() public {
        vm.expectRevert(VirtuHomeScheme.InvalidContentHash.selector);
        vm.prank(alice);
        scheme.mint(0, bytes32(0), URI_1);
    }

    function test_RevertWhen_MetadataURLEmpty() public {
        vm.expectRevert(VirtuHomeScheme.EmptyTokenURI.selector);
        vm.prank(alice);
        scheme.mint(0, HASH_1, "");
    }

    function test_RevertWhen_ReadUnknownScheme() public {
        vm.expectRevert();
        scheme.schemeOf(99);
    }

    function test_DuplicateContentHashKeepsFirstTokenId() public {
        vm.prank(alice);
        scheme.mint(0, HASH_1, URI_1);
        vm.prank(bob);
        scheme.mint(0, HASH_1, URI_2);
        assertEq(scheme.hashToTokenId(HASH_1), 1, "first mint owns the hash index");
        assertEq(scheme.totalSupply(), 2, "duplicate content is still mintable");
    }

    function test_Royalty_DefaultFivePercent() public {
        vm.prank(alice);
        scheme.mint(0, HASH_1, URI_1);

        (address receiver, uint256 amount) = scheme.royaltyInfo(1, 10_000 ether);
        assertEq(receiver, royaltyReceiver, "royalty receiver");
        assertEq(amount, 500 ether, "5% of 10_000 ether");
        assertEq(scheme.ROYALTY_BPS(), 500);
    }

    function testFuzz_Royalty_AlwaysFivePercent(uint96 salePrice) public {
        vm.prank(alice);
        scheme.mint(0, HASH_1, URI_1);
        (, uint256 amount) = scheme.royaltyInfo(1, salePrice);
        assertEq(amount, (uint256(salePrice) * 500) / 10_000);
        assertLe(amount, salePrice, "royalty never exceeds sale price");
    }

    function test_OwnerCanUpdateRoyalty() public {
        address newReceiver = makeAddr("newRoyalty");
        vm.prank(owner);
        scheme.setRoyalty(newReceiver, 1_000);
        (address receiver, uint256 amount) = scheme.royaltyInfo(1, 1 ether);
        assertEq(receiver, newReceiver);
        assertEq(amount, 0.1 ether);
    }

    function test_RevertWhen_NonOwnerUpdatesRoyalty() public {
        vm.expectRevert();
        vm.prank(alice);
        scheme.setRoyalty(alice, 1_000);
    }

    function test_RevertWhen_RoyaltyAboveTenPercent() public {
        vm.expectRevert("fee exceeds 10%");
        vm.prank(owner);
        scheme.setRoyalty(owner, 1_001);
    }

    function test_SupportsInterfaces() public {
        assertTrue(scheme.supportsInterface(type(IERC721).interfaceId));
        assertTrue(scheme.supportsInterface(type(IERC2981).interfaceId));
        assertFalse(scheme.supportsInterface(0xdeadbeef));
    }

    function test_VersionLine_GroupsSameAuthorVersionsInOrder() public {
        vm.prank(alice);
        scheme.mint(0, HASH_1, URI_1); // #1 v1
        vm.prank(alice);
        scheme.mint(1, HASH_2, URI_2); // #2 v2（parentId 指向自己上一版）
        vm.prank(alice);
        scheme.mint(2, HASH_3, URI_3); // #3 v3

        uint256[] memory line = scheme.versionLineOf(3);
        assertEq(line.length, 3, "v1..v3");
        assertEq(line[0], 1);
        assertEq(line[1], 2);
        assertEq(line[2], 3);

        // 查看历史版本时同样能看到完整版本链
        uint256[] memory fromV2 = scheme.versionLineOf(2);
        assertEq(fromV2.length, 3);
        assertEq(fromV2[0], 1);
        assertEq(fromV2[2], 3, unicode"最新版本可见");
    }

    function test_VersionLine_ExcludesOtherAuthorsRemix() public {
        vm.prank(alice);
        scheme.mint(0, HASH_1, URI_1); // #1 alice v1
        vm.prank(bob);
        scheme.mint(1, HASH_2, URI_2); // #2 bob 的 remix，不属于 alice 版本链
        vm.prank(alice);
        scheme.mint(1, HASH_3, URI_3); // #3 alice v2（parentId 仍指向自己的 #1）

        uint256[] memory aliceLine = scheme.versionLineOf(3);
        assertEq(aliceLine.length, 2, unicode"只包含同作者版本");
        assertEq(aliceLine[0], 1);
        assertEq(aliceLine[1], 3);

        uint256[] memory bobLine = scheme.versionLineOf(2);
        assertEq(bobLine.length, 1);
        assertEq(bobLine[0], 2);
    }

    function test_VersionLine_SingleOriginalScheme() public {
        vm.prank(alice);
        scheme.mint(0, HASH_1, URI_1);
        uint256[] memory line = scheme.versionLineOf(1);
        assertEq(line.length, 1);
        assertEq(line[0], 1);
    }

    function test_VersionLine_RevertWhenUnknownToken() public {
        vm.expectRevert();
        scheme.versionLineOf(999);
    }

    function test_CreatorStaysAttributedAfterTransfer() public {
        vm.prank(alice);
        scheme.mint(0, HASH_1, URI_1);
        vm.prank(alice);
        scheme.transferFrom(alice, bob, 1);
        assertEq(scheme.ownerOf(1), bob, "owner moved");
        assertEq(scheme.creatorOf(1), alice, "creator attribution unchanged");
    }
}
