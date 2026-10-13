// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {DreamScheme} from "../src/DreamScheme.sol";
import {SchemeMarket} from "../src/SchemeMarket.sol";

contract RevertingReceiver {
    receive() external payable {
        revert("no eth");
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

/// @title SchemeMarketTest — usage-rights trading and lineage splits
contract SchemeMarketTest is Test {
    AgentRegistry internal agents;
    DreamScheme internal scheme;
    SchemeMarket internal market;

    address internal platform = makeAddr("platform");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    function setUp() public {
        agents = new AgentRegistry(address(this));
        scheme = new DreamScheme(agents);
        market = new SchemeMarket(scheme, payable(platform));
        deal(carol, 10 ether);
    }

    function _mintOriginal(address creator) internal returns (uint256) {
        vm.prank(creator);
        return scheme.mint(0, keccak256(abi.encodePacked(creator, "orig")), 0, "ipfs://o");
    }

    function _remix(address creator, uint256 parentId) internal returns (uint256) {
        vm.prank(creator);
        return scheme.remix(parentId, keccak256(abi.encodePacked(creator, parentId)), 0, "ipfs://r");
    }

    // ------------------------------ Pricing -------------------------------- //

    function test_SetPrice_OnlyCreator() public {
        _mintOriginal(alice);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SchemeMarket.NotCreator.selector, bob, 1));
        market.setPrice(1, 0.1 ether);
    }

    function test_SetPrice_UnmintedRejected() public {
        vm.expectRevert(abi.encodeWithSelector(SchemeMarket.SchemeNotMinted.selector, 99));
        market.setPrice(99, 0.1 ether);
    }

    function test_SetPrice_AndDelist() public {
        _mintOriginal(alice);
        vm.prank(alice);
        market.setPrice(1, 0.1 ether);
        assertEq(market.priceOf(1), 0.1 ether);

        // price 0 = delisted
        vm.prank(alice);
        market.setPrice(1, 0);
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(SchemeMarket.NotListed.selector, 1));
        market.applyScheme{value: 0.1 ether}(1);
    }

    // --------------------------- Buy: original ----------------------------- //

    function test_Apply_Original_90_10() public {
        _mintOriginal(alice);
        vm.prank(alice);
        market.setPrice(1, 1 ether);

        vm.prank(carol);
        market.applyScheme{value: 1 ether}(1);

        assertEq(alice.balance, 0.9 ether);
        assertEq(platform.balance, 0.1 ether);
        assertEq(market.appliedCount(1), 1);
        assertEq(market.totalApplied(), 1);
        assertEq(carol.balance, 9 ether);
    }

    function test_Apply_UnderpayRejected() public {
        _mintOriginal(alice);
        vm.prank(alice);
        market.setPrice(1, 0.1 ether);
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(SchemeMarket.InvalidPaymentAmount.selector, 0.05 ether, 0.1 ether));
        market.applyScheme{value: 0.05 ether}(1);
    }

    function test_Apply_NotListedRejected() public {
        _mintOriginal(alice);
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(SchemeMarket.NotListed.selector, 1));
        market.applyScheme{value: 1 ether}(1);
    }

    function test_Apply_OverpayRefunded() public {
        _mintOriginal(alice);
        vm.prank(alice);
        market.setPrice(1, 0.1 ether);

        vm.prank(carol);
        market.applyScheme{value: 0.15 ether}(1);

        assertEq(alice.balance, 0.09 ether);
        assertEq(platform.balance, 0.01 ether);
        assertEq(carol.balance, 10 ether - 0.1 ether, unicode"overpayment should be refunded");
    }

    // --------------------------- Buy: derivative ---------------------------- //

    function test_Apply_Remix_85_10_5() public {
        _mintOriginal(alice); // 1
        _remix(bob, 1); // 2: bob's derivative scheme
        vm.prank(bob);
        market.setPrice(2, 0.1 ether);

        vm.prank(carol);
        market.applyScheme{value: 0.1 ether}(2);

        // bob (remixer) 85%, alice (original) 5%, platform 10%
        assertEq(bob.balance, 0.085 ether);
        assertEq(alice.balance, 0.005 ether);
        assertEq(platform.balance, 0.01 ether);
        // conservation: 0.085 + 0.005 + 0.01 = 0.1
    }

    function test_Apply_SelfRemix_AncestorShareMergesIntoCreator() public {
        _mintOriginal(alice); // 1
        _remix(alice, 1); // 2: alice remixes her own original
        vm.prank(alice);
        market.setPrice(2, 0.1 ether);

        vm.prank(carol);
        market.applyScheme{value: 0.1 ether}(2);

        // The ancestor (= original author = alice herself) share folds into the main portion: 85% + 5% = 90%
        assertEq(alice.balance, 0.09 ether);
        assertEq(platform.balance, 0.01 ether);
    }

    function test_Apply_DeepLineage_UniqueAncestors() public {
        // A(1) <- B(2) <- C(3) <- D(4), four distinct creators; buyer erin does not overlap with on-chain creators
        _mintOriginal(alice);
        _remix(bob, 1);
        _remix(carol, 2);
        address dave = makeAddr("dave");
        _remix(dave, 3);
        vm.prank(dave);
        market.setPrice(4, 1 ether);

        address erin = makeAddr("erin");
        deal(erin, 2 ether);
        vm.prank(erin);
        market.applyScheme{value: 1 ether}(4);

        // remixer dave 85%; ancestors {C, B, A} deduplicated and split evenly 5%; platform 10%
        uint256 each = uint256(0.05 ether) / 3;
        assertEq(dave.balance, 0.85 ether);
        assertEq(carol.balance, 10 ether + each, unicode"carol is an ancestor creator (deal starts at 10 ETH)");
        assertEq(bob.balance, each);
        assertEq(alice.balance, each);
        assertEq(platform.balance, 0.1 ether + (0.05 ether - each * 3), unicode"rounding remainder goes to the platform");
        assertEq(erin.balance, 1 ether, unicode"buyer pays 1 ether");
    }

    function test_Apply_DuplicateAncestorCountedOnce() public {
        // A(1) <- B(2) <- A(3): 3's ancestors = {B, A}, and A is also the remixer
        _mintOriginal(alice);
        _remix(bob, 1);
        _remix(alice, 2); // 3: alice remixes bob's derivative
        vm.prank(alice);
        market.setPrice(3, 0.06 ether);

        vm.prank(carol);
        market.applyScheme{value: 0.06 ether}(3);

        // main portion 85% = 0.051; ancestor pool 5% = 0.003, ancestors {B, A} split evenly -> each = 0.0015
        // alice's ancestor share folds into the main portion: 0.051 + 0.0015
        uint256 each = 0.003 ether / 2;
        assertEq(alice.balance, 0.051 ether + each);
        assertEq(bob.balance, each);
        assertEq(platform.balance, 0.006 ether);
    }

    function test_Apply_DustOneWei_AllToPlatform() public {
        // A 1 wei derivative scheme: main/ancestor shares are all 0, dust goes to the platform (amount conserved)
        _mintOriginal(alice); // 1
        _remix(bob, 1); // 2
        address cat = makeAddr("cat");
        _remix(cat, 2); // 3: ancestors = {bob, alice}
        vm.prank(cat);
        market.setPrice(3, 1 wei);

        vm.prank(carol);
        market.applyScheme{value: 1 wei}(3);

        assertEq(cat.balance, 0, "creator cut = 0");
        assertEq(bob.balance, 0, "ancestor each = 0");
        assertEq(alice.balance, 0, "ancestor each = 0");
        assertEq(platform.balance, 1, unicode"1 wei dust goes to the platform");
    }

    function test_Apply_PaymentFailedReverts() public {
        RevertingReceiver rr = new RevertingReceiver();
        vm.prank(address(rr));
        scheme.mint(0, keccak256("rr-plan"), 0, "ipfs://rr");
        vm.prank(address(rr));
        market.setPrice(1, 0.1 ether);

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(SchemeMarket.PaymentFailed.selector, address(rr)));
        market.applyScheme{value: 0.1 ether}(1);
    }

    // ------------------------------ Preview -------------------------------- //

    function test_SplitPreview_Original() public view {
        (uint256 creatorCut, uint256 platformCut, uint256 pool,) = market.splitPreview(1, 1 ether);
        // token 1 unminted -> parentOf = 0 -> original path
        assertEq(creatorCut, 0.9 ether);
        assertEq(platformCut, 0.1 ether);
        assertEq(pool, 0);
    }

    function test_SplitPreview_Remix() public {
        _mintOriginal(alice);
        _remix(bob, 1);
        (uint256 creatorCut, uint256 platformCut, uint256 pool, address[] memory ancestors) =
            market.splitPreview(2, 0.1 ether);
        assertEq(creatorCut, 0.085 ether);
        assertEq(platformCut, 0.01 ether);
        assertEq(pool, 0.005 ether);
        assertEq(ancestors.length, 1);
        assertEq(ancestors[0], alice);
    }

    // ------------------------------- Counts -------------------------------- //

    function test_AppliedCount_Accumulates() public {
        _mintOriginal(alice);
        vm.prank(alice);
        market.setPrice(1, 0.01 ether);

        vm.startPrank(carol);
        market.applyScheme{value: 0.01 ether}(1);
        market.applyScheme{value: 0.01 ether}(1);
        vm.stopPrank();

        assertEq(market.appliedCount(1), 2);
        assertEq(market.totalApplied(), 2);
        assertEq(alice.balance, 0.018 ether);
        assertEq(platform.balance, 0.002 ether);
    }

    // ---------------------------- Payout address --------------------------- //

    function test_SetPayout_OnlyCreator() public {
        _mintOriginal(alice);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SchemeMarket.NotCreator.selector, bob, 1));
        market.setPayout(1, makeAddr("wallet"));
    }

    function test_SetPayout_UnmintedRejected() public {
        vm.expectRevert(abi.encodeWithSelector(SchemeMarket.SchemeNotMinted.selector, 99));
        market.setPayout(99, makeAddr("wallet"));
    }

    function test_Apply_Original_PaysPayoutAddress() public {
        _mintOriginal(alice);
        address wallet = makeAddr("aliceWallet");
        vm.startPrank(alice);
        market.setPayout(1, wallet);
        market.setPrice(1, 1 ether);
        vm.stopPrank();

        vm.prank(carol);
        market.applyScheme{value: 1 ether}(1);

        assertEq(wallet.balance, 0.9 ether, unicode"90% goes directly to the payout address");
        assertEq(alice.balance, 0, unicode"the creator address no longer receives funds");
        assertEq(platform.balance, 0.1 ether);
    }

    function test_SetPayout_ResetToDefault() public {
        _mintOriginal(alice);
        address wallet = makeAddr("aliceWallet");
        vm.startPrank(alice);
        market.setPayout(1, wallet);
        market.setPayout(1, address(0)); // reset to default
        market.setPrice(1, 1 ether);
        vm.stopPrank();

        vm.prank(carol);
        market.applyScheme{value: 1 ether}(1);

        assertEq(alice.balance, 0.9 ether, unicode"after reset it returns to the creator address");
        assertEq(wallet.balance, 0);
    }

    function test_Apply_Remix_AncestorPayoutRouted() public {
        _mintOriginal(alice); // 1
        address aliceWallet = makeAddr("aliceWallet");
        vm.prank(alice);
        market.setPayout(1, aliceWallet); // route the original's revenue to the wallet
        _remix(bob, 1); // 2
        vm.prank(bob);
        market.setPrice(2, 0.1 ether);

        vm.prank(carol);
        market.applyScheme{value: 0.1 ether}(2);

        assertEq(bob.balance, 0.085 ether, unicode"remixer 85%");
        assertEq(aliceWallet.balance, 0.005 ether, unicode"lineage 5% goes to the original's payout address");
        assertEq(alice.balance, 0, unicode"the original creator address receives nothing");
        assertEq(platform.balance, 0.01 ether);
    }

    function test_Apply_SelfRemix_MergesByPayoutAddress() public {
        _mintOriginal(alice); // 1
        address wallet = makeAddr("aliceWallet");
        vm.prank(alice);
        market.setPayout(1, wallet); // ancestor #1's payout address
        uint256 id2 = _remix(alice, 1); // 2
        vm.prank(alice);
        market.setPayout(id2, wallet); // remixer #2 has the same payout address
        vm.prank(alice);
        market.setPrice(id2, 0.1 ether);

        vm.prank(carol);
        market.applyScheme{value: 0.1 ether}(id2);

        // 85% + 5% merge into the same payout address
        assertEq(wallet.balance, 0.09 ether);
        assertEq(platform.balance, 0.01 ether);
    }

    function test_PayoutSet_EmitsEvent() public {
        _mintOriginal(alice);
        address wallet = makeAddr("aliceWallet");
        vm.expectEmit(true, true, false, true);
        emit SchemeMarket.PayoutSet(1, alice, wallet);
        vm.prank(alice);
        market.setPayout(1, wallet);
    }
}
