// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {VirtuHomeScheme} from "../src/VirtuHomeScheme.sol";
import {SchemeMarket} from "../src/SchemeMarket.sol";

/// @notice 可持有 NFT、但拒绝接收原生 ETH 的合约，用于测试创作者代管分支。
contract RejectEth is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {
        revert("reject eth");
    }
}

/// @notice SchemeMarket 付费应用到我家 + 90/10 分账的单元测试。
contract SchemeMarketTest is Test {
    VirtuHomeScheme internal scheme;
    SchemeMarket internal market;

    address internal owner = makeAddr("owner");
    address internal platform = makeAddr("platform");
    address internal creator = makeAddr("creator");
    address internal creator2 = makeAddr("creator2");
    address internal applier = makeAddr("applier");

    uint256 internal constant PRICE = 0.01 ether;
    bytes32 internal constant HASH_1 = keccak256("scheme-1");
    bytes32 internal constant HASH_2 = keccak256("scheme-2");

    event SchemeApplied(
        uint256 indexed tokenId,
        address indexed applier,
        address indexed creator,
        uint256 value,
        uint256 creatorShare,
        uint256 platformShare
    );
    event CreatorShareEscrowed(uint256 indexed tokenId, address indexed creator, uint256 amount);

    function setUp() public {
        vm.prank(owner);
        scheme = new VirtuHomeScheme(owner, address(0));
        vm.prank(owner);
        market = new SchemeMarket(scheme, owner, platform);

        vm.prank(creator);
        scheme.mint(0, HASH_1, "ipfs://one");
        vm.prank(creator2);
        scheme.mint(1, HASH_2, "ipfs://two");
    }

    function test_ApplyScheme_Splits90ToCreator10ToPlatform() public {
        vm.deal(applier, PRICE);

        uint256 expectedCreatorShare = (PRICE * 9_000) / 10_000; // exactly 90%
        uint256 expectedPlatformShare = PRICE - expectedCreatorShare; // exactly 10%

        vm.expectEmit(true, true, true, true, address(market));
        emit SchemeApplied(1, applier, creator, PRICE, expectedCreatorShare, expectedPlatformShare);

        vm.prank(applier);
        (uint256 creatorShare, uint256 platformShare) = market.applyScheme{value: PRICE}(1);

        assertEq(creatorShare, expectedCreatorShare, "creator gets 90%");
        assertEq(platformShare, expectedPlatformShare, "platform gets 10%");
        assertEq(creator.balance, expectedCreatorShare, "creator balance credited");
        assertEq(market.pendingWithdrawals(platform), expectedPlatformShare, "platform share accummulated");
        assertEq(applier.balance, 0, "applier paid exactly the price");
        assertEq(market.appliedCount(1), 1);
        assertEq(market.totalApplied(), 1);
    }

    function test_Apply_AccumulatesCountsAndPlatformBalance() public {
        vm.deal(applier, PRICE * 3);
        uint256 balanceBefore = platform.balance;

        vm.prank(applier);
        market.applyScheme{value: PRICE}(1);
        vm.prank(applier);
        market.applyScheme{value: PRICE}(1);
        vm.prank(applier);
        market.applyScheme{value: PRICE}(2);

        assertEq(market.appliedCount(1), 2);
        assertEq(market.appliedCount(2), 1);
        assertEq(market.totalApplied(), 3);
        assertEq(platform.balance, balanceBefore, "platform balance untouched before withdraw");
        assertEq(market.pendingWithdrawals(platform), PRICE * 3 / 10);
        assertEq(creator.balance, PRICE * 2 * 9 / 10, "creator credited twice");
        assertEq(creator2.balance, PRICE * 9 / 10);
    }

    function test_SplitOf_MatchesBps() public {
        (uint256 creatorShare, uint256 platformShare) = market.splitOf(PRICE);
        assertEq(creatorShare, PRICE * 90 / 100);
        assertEq(platformShare, PRICE * 10 / 100);
        assertEq(creatorShare + platformShare, PRICE, "no rounding dust outside split");
    }

    function test_RevertWhen_WrongPaymentAmount() public {
        vm.deal(applier, 1 ether);
        vm.expectRevert(abi.encodeWithSelector(SchemeMarket.InvalidPaymentAmount.selector, 1 ether, PRICE));
        vm.prank(applier);
        market.applyScheme{value: 1 ether}(1);
    }

    function test_RevertWhen_ZeroPayment() public {
        vm.expectRevert(abi.encodeWithSelector(SchemeMarket.InvalidPaymentAmount.selector, 0, PRICE));
        vm.prank(applier);
        market.applyScheme(1);
    }

    function test_RevertWhen_SchemeNotMinted() public {
        vm.deal(applier, PRICE);
        vm.expectRevert(abi.encodeWithSelector(SchemeMarket.SchemeNotMinted.selector, 999));
        vm.prank(applier);
        market.applyScheme{value: PRICE}(999);
    }

    function test_Platform_CanWithdrawAccumulatedShare() public {
        vm.deal(applier, PRICE);
        vm.prank(applier);
        market.applyScheme{value: PRICE}(1);

        uint256 platformShare = market.pendingWithdrawals(platform);
        assertGt(platformShare, 0);

        vm.expectEmit(true, true, true, true, address(market));
        emit SchemeMarket.Withdrawn(platform, platformShare);

        vm.prank(platform);
        uint256 amount = market.withdraw();

        assertEq(amount, platformShare);
        assertEq(platform.balance, platformShare);
        assertEq(market.pendingWithdrawals(platform), 0, "balance zeroed after withdraw");
    }

    function test_RevertWhen_NothingToWithdraw() public {
        vm.expectRevert(SchemeMarket.NothingToWithdraw.selector);
        vm.prank(platform);
        market.withdraw();
    }

    function test_CreatorShareEscrowed_WhenCreatorRejectsEth() public {
        RejectEth reject = new RejectEth();
        vm.prank(address(reject));
        scheme.mint(0, keccak256("reject-scheme"), "ipfs://reject");

        vm.deal(applier, PRICE);
        vm.expectEmit(true, true, true, true, address(market));
        emit CreatorShareEscrowed(3, address(reject), PRICE * 9 / 10);

        vm.prank(applier);
        market.applyScheme{value: PRICE}(3);

        uint256 expectedPlatform = (PRICE * 10 / 100) + (PRICE * 90 / 100);
        assertEq(market.pendingWithdrawals(platform), expectedPlatform, "creator share escrowed to platform account");
        assertEq(address(reject).balance, 0, "rejecting contract received nothing");
        assertEq(market.appliedCount(3), 1, "apply still succeeds");
    }

    function test_Owner_CanUpdatePlatformAddressAndPrice() public {
        address newPlatform = makeAddr("newPlatform");

        vm.prank(owner);
        market.setPlatformAddress(newPlatform);
        assertEq(market.platformAddress(), newPlatform);

        vm.prank(owner);
        market.setApplyPrice(2 ether);
        assertEq(market.applyPrice(), 2 ether);

        vm.deal(applier, 2 ether);
        vm.prank(applier);
        market.applyScheme{value: 2 ether}(1);
        assertEq(market.pendingWithdrawals(newPlatform), 2 ether * 10 / 100, "new platform collects");
        assertEq(creator.balance, 2 ether * 90 / 100);
    }

    function test_RevertWhen_NonOwnerUpdatesConfig() public {
        vm.expectRevert();
        vm.prank(creator);
        market.setPlatformAddress(creator);

        vm.expectRevert();
        vm.prank(creator);
        market.setApplyPrice(1 ether);

        vm.expectRevert();
        vm.prank(creator);
        market.setCreatorShareBps(5_000);
    }

    function test_RevertWhen_PlatformAddressZero() public {
        vm.expectRevert(SchemeMarket.InvalidPlatformAddress.selector);
        vm.prank(owner);
        market.setPlatformAddress(address(0));
    }

    function test_DefaultApplyPriceIsTenMillis() public {
        assertEq(market.applyPrice(), 0.01 ether, "default price is 0.01 MON");
    }
}
