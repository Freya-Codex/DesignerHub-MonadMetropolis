// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {P256} from "../src/lib/P256.sol";
import {P256PasskeyAccount, PasskeyAccountFactory} from "../src/P256PasskeyAccount.sol";
import {Fixtures} from "./utils/Fixtures.t.sol";

contract Counter {
    uint256 public hits;

    function hit() external payable {
        hits += 1;
    }
}

contract Reverter {
    function boom() external pure {
        revert("boom");
    }
}

/// @dev 用固定挑战公式覆盖真实派生（真实公式含部署后才能确定的账户地址，
///      离线无法预签名）。固定公式与 fixtures.json 的派生约定一致。
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

/// @title P256PasskeyAccountTest — passkey 账户 + CREATE2 工厂
contract P256PasskeyAccountTest is Fixtures {
    FixedChallengeAccount internal account;
    Counter internal counter;
    bytes32 internal base;
    uint256 internal x1;
    uint256 internal y1;
    uint256 internal x2;
    uint256 internal y2;

    function setUp() public override {
        super.setUp();
        base = _fxBytes32(".challenge");
        (x1, y1) = _fxKey(0);
        (x2, y2) = _fxKey(1);
        account = new FixedChallengeAccount(x1, y1, fxRpIdHash, fxOriginHash, base);
        counter = new Counter();
        deal(address(account), 1 ether);
    }

    // ------------------------------- execute ------------------------------ //

    function test_Execute_WithValidAssertion() public {
        account.execute(address(counter), 0, abi.encodeCall(Counter.hit, ()), _fxAssertion("key1_single_n0"));
        assertEq(counter.hits(), 1);
        assertEq(account.nonce(), 1);
    }

    function test_Execute_SendsValue() public {
        account.execute(address(counter), 0.3 ether, abi.encodeCall(Counter.hit, ()), _fxAssertion("key1_single_n0"));
        assertEq(address(counter).balance, 0.3 ether);
        assertEq(address(account).balance, 0.7 ether);
    }

    function test_Execute_ReplayRejected() public {
        account.execute(address(counter), 0, abi.encodeCall(Counter.hit, ()), _fxAssertion("key1_single_n0"));
        vm.expectRevert(P256PasskeyAccount.InvalidSignature.selector);
        account.execute(address(counter), 0, abi.encodeCall(Counter.hit, ()), _fxAssertion("key1_single_n0"));
    }

    function test_Execute_WrongKeyRejected() public {
        vm.expectRevert(P256PasskeyAccount.InvalidSignature.selector);
        account.execute(address(counter), 0, abi.encodeCall(Counter.hit, ()), _fxAssertion("key2_single_n0"));
    }

    function test_Execute_WrongRpIdRejected() public {
        vm.expectRevert(P256PasskeyAccount.InvalidSignature.selector);
        account.execute(address(counter), 0, abi.encodeCall(Counter.hit, ()), _fxAssertion("wrongRp"));
    }

    function test_Execute_WrongTypeRejected() public {
        vm.expectRevert(P256PasskeyAccount.InvalidSignature.selector);
        account.execute(address(counter), 0, abi.encodeCall(Counter.hit, ()), _fxAssertion("wrongType"));
    }

    function test_Execute_TamperedSigRejected() public {
        vm.expectRevert(P256PasskeyAccount.InvalidSignature.selector);
        account.execute(address(counter), 0, abi.encodeCall(Counter.hit, ()), _fxAssertion("tamperedSig"));
    }

    function test_Execute_OriginMismatchRejected() public {
        FixedChallengeAccount evil =
            new FixedChallengeAccount(x1, y1, fxRpIdHash, keccak256("https://evil.example"), base);
        vm.expectRevert(P256PasskeyAccount.BadOrigin.selector);
        evil.execute(address(counter), 0, abi.encodeCall(Counter.hit, ()), _fxAssertion("key1_single_n0"));
    }

    function test_Execute_OriginCheckDisabled() public {
        FixedChallengeAccount lax = new FixedChallengeAccount(x1, y1, fxRpIdHash, bytes32(0), base);
        lax.execute(address(counter), 0, abi.encodeCall(Counter.hit, ()), _fxAssertion("key1_single_n0"));
        assertEq(counter.hits(), 1);
    }

    function test_Execute_CalledTargetReverts() public {
        Reverter r = new Reverter();
        vm.expectRevert(abi.encodeWithSelector(P256PasskeyAccount.CallFailed.selector, 0));
        account.execute(address(r), 0, abi.encodeCall(Reverter.boom, ()), _fxAssertion("key1_single_n0"));
    }

    // ----------------------------- executeBatch --------------------------- //

    function test_ExecuteBatch_TwoCalls() public {
        address[] memory to = new address[](2);
        uint256[] memory value = new uint256[](2);
        bytes[] memory data = new bytes[](2);
        to[0] = address(counter);
        to[1] = address(counter);
        data[0] = abi.encodeCall(Counter.hit, ());
        data[1] = abi.encodeCall(Counter.hit, ());
        account.executeBatch(to, value, data, _fxAssertion("key1_batch_n0"));
        assertEq(counter.hits(), 2);
        assertEq(account.nonce(), 1);
    }

    function test_ExecuteBatch_LengthMismatch() public {
        address[] memory to = new address[](2);
        uint256[] memory value = new uint256[](1);
        bytes[] memory data = new bytes[](2);
        vm.expectRevert(P256PasskeyAccount.BatchLengthMismatch.selector);
        account.executeBatch(to, value, data, _fxAssertion("key1_batch_n0"));
    }

    function test_ExecuteBatch_ReplayRejected() public {
        address[] memory to = new address[](1);
        uint256[] memory value = new uint256[](1);
        bytes[] memory data = new bytes[](1);
        to[0] = address(counter);
        data[0] = abi.encodeCall(Counter.hit, ());
        account.executeBatch(to, value, data, _fxAssertion("key1_batch_n0"));
        vm.expectRevert(P256PasskeyAccount.InvalidSignature.selector);
        account.executeBatch(to, value, data, _fxAssertion("key1_batch_n0"));
    }

    // ------------------------------- addKey ------------------------------- //

    function test_AddKey_OnlySelfCall() public {
        vm.expectRevert(P256PasskeyAccount.InvalidSignature.selector);
        account.addKey(x2, y2);
    }

    function test_AddKey_OffCurveRejected() public {
        vm.prank(address(account));
        vm.expectRevert(P256PasskeyAccount.InvalidPublicKey.selector);
        account.addKey(1, 1);
    }

    function test_AddKey_RecoveryFlow_NewDeviceCanAct() public {
        // 第一步：旧设备（key1，nonce=0）签名授权追加新公钥 key2
        account.execute(
            address(account), 0, abi.encodeCall(P256PasskeyAccount.addKey, (x2, y2)), _fxAssertion("key1_single_n0")
        );
        assertEq(account.keyCount(), 2);
        (uint256 kx, uint256 ky) = account.keyAt(1);
        assertEq(kx, x2);
        assertEq(ky, y2);

        // 第二步：新设备（key2）在 nonce=1 直接发起交易
        account.execute(address(counter), 0, abi.encodeCall(Counter.hit, ()), _fxAssertion("key2_single_n1"));
        assertEq(counter.hits(), 1);
        assertEq(account.nonce(), 2);
    }

    function test_AddKey_TooManyKeys() public {
        vm.startPrank(address(account));
        account.addKey(x2, y2); // 第 2 把
        account.addKey(P256.GX, P256.GY); // 第 3 把：生成元 G
        account.addKey(P256.GX, P256.PP - P256.GY); // 第 4 把：−G（同在曲线上）
        vm.expectRevert(P256PasskeyAccount.TooManyKeys.selector);
        account.addKey(x2, y2); // 第 5 把 → 超限
        vm.stopPrank();
    }

    // ------------------------------- 工厂 --------------------------------- //

    function test_Factory_Create2Deterministic() public {
        PasskeyAccountFactory factory = new PasskeyAccountFactory();
        address predicted = factory.accountOf(x1, y1, fxRpIdHash, fxOriginHash);
        assertTrue(predicted != address(0));

        P256PasskeyAccount acct = factory.createAccount(x1, y1, fxRpIdHash, fxOriginHash);
        assertEq(address(acct), predicted);
        assertEq(acct.keyCount(), 1);
        (uint256 kx, uint256 ky) = acct.keyAt(0);
        assertEq(kx, x1);
        assertEq(ky, y1);

        // 不同公钥 → 不同地址
        assertTrue(factory.accountOf(x2, y2, fxRpIdHash, fxOriginHash) != predicted);

        // 同一 passkey 重复部署 → AccountExists
        vm.expectRevert(abi.encodeWithSelector(PasskeyAccountFactory.AccountExists.selector, predicted));
        factory.createAccount(x1, y1, fxRpIdHash, fxOriginHash);
    }

    // --------------------------- 真实挑战公式 ------------------------------ //

    function test_ChallengePreview_MatchesSpecFormula() public {
        P256PasskeyAccount real = new P256PasskeyAccount(x1, y1, fxRpIdHash, fxOriginHash);
        bytes32 dataHash = keccak256(bytes("some calldata"));
        bytes32 expected = keccak256(
            abi.encodePacked(
                "dh/passkey/tx", address(real), block.chainid, uint256(7), address(0xBEEF), uint256(1 ether), dataHash
            )
        );
        assertEq(real.challengePreview(7, address(0xBEEF), 1 ether, dataHash), expected);
    }

    // ------------------------------- 杂项 --------------------------------- //

    function test_Constructor_OffCurveKeyRejected() public {
        vm.expectRevert(P256PasskeyAccount.InvalidPublicKey.selector);
        new FixedChallengeAccount(1, 1, fxRpIdHash, fxOriginHash, base);
    }

    function test_ReceiveEther() public {
        (bool ok,) = address(account).call{value: 1 wei}("");
        assertTrue(ok);
        assertEq(address(account).balance, 1 ether + 1 wei);
    }
}
