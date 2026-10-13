// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {P256} from "./lib/P256.sol";
import {WebAuthn} from "./lib/WebAuthn.sol";

/// @title P256PasskeyAccount — seedless WebAuthn / passkey smart account
///
/// @notice ## Key derivation flow
///
/// This contract never generates, stores, or can ever touch any private key:
///
///   1. [Generated on device] The user calls `navigator.credentials.create()` on the website; the browser asks the
///      platform authenticator (iPhone Secure Enclave / Android StrongBox / laptop TPM)
///      to generate a **P-256 (secp256r1)** asymmetric key pair. The private key is generated inside the
///      secure chip, and hardware guarantees it is never exportable (kSecAttrTokenIDSecureEnclave / TPM_NO_DA).
///   2. [Public key on-chain] The website reads the public key (x, y) from the registration response's `getPublicKey()`
///      and deploys this contract through PasskeyAccountFactory via CREATE2 (salt = keccak256(x, y, rpIdHash, originHash)).
///      The account address is known before deployment (counterfactual), so no ETH needs to be sent first.
///   3. [Signature authorization] For every transaction, the website derives a 32-byte challenge as
///      `challenge = keccak256(account ‖ chainId ‖ nonce ‖ to ‖ value ‖ keccak256(data))`
///      and calls `navigator.credentials.get()` to trigger Face ID / Touch ID /
///      Windows Hello. The authenticator signs `sha256(authenticatorData ‖ sha256(clientDataJSON))`
///      with P-256 per the WebAuthn spec.
///   4. [On-chain verification] This contract recomputes the challenge → checks authenticatorData (RP ID binding + UP flag) →
///      checks clientDataJSON (type / challenge match) → verifies the P-256 signature (the public key being the
///      registered key stored in the contract). Only if all pass does it execute the call and increment the nonce (replay protection).
///
/// Throughout: no private key, no seed phrase, no keystore file; the user's identity = the hardware key in the device secure chip.
/// Multi-device recovery: sign with an old passkey to call addKey() and append a new public key (max 4).
///
/// @notice ## Gasless (relayer mode)
///
/// The caller of `execute / executeBatch` (the relayer) needs no authorization whatsoever — authorization comes entirely from
/// the WebAuthn signature covering "the exact operation + nonce". Anyone (including our /api/relay) can
/// submit and pay for the transaction, and cannot tamper with the operation (the challenge covers the calldata hash).
///
/// @dev The challenge derivation functions _challengeSingle / _challengeBatch are virtual so tests can override
///      them with a fixed-challenge subclass, enabling full round-trip tests using offline WebAuthn assertion fixtures.
contract P256PasskeyAccount {
    using WebAuthn for WebAuthn.Assertion;

    /// @notice Max passkeys registered per account (multi-device recovery).
    uint256 public constant MAX_KEYS = 4;

    /// @notice Transaction sequence number, for replay protection.
    uint256 public nonce;

    /// @notice Expected sha256(RP ID). The RP ID is the site's registration domain, e.g. "designerhub.xyz".
    bytes32 public immutable rpIdHash;
    /// @notice Expected keccak256(origin URL) (e.g. "https://designerhub.xyz").
    ///         Set to bytes32(0) to skip origin verification (local development).
    bytes32 public immutable originHash;

    /// @notice The list of registered passkey public keys (x, y).
    uint256[2][] private _keys;

    event Executed(address indexed to, uint256 value, uint256 nonceAfter);
    event BatchExecuted(uint256 count, uint256 nonceAfter);
    event KeyAdded(uint256 indexed keyIndex, uint256 x, uint256 y);

    error InvalidPublicKey();
    error InvalidSignature();
    error BadOrigin();
    error TooManyKeys();
    error CallFailed(uint256 index);
    error BatchLengthMismatch();
    error CreateFailed();

    constructor(uint256 x, uint256 y, bytes32 _rpIdHash, bytes32 _originHash) {
        if (!P256.onCurve(x, y)) revert InvalidPublicKey();
        _keys.push([x, y]);
        rpIdHash = _rpIdHash;
        originHash = _originHash;
    }

    /// @notice The account can receive ETH directly (balance is not required in relayer mode, but self-paying ability is retained).
    receive() external payable {}

    /// @notice Receive ERC-721 (scheme NFTs minted into this account): the wallet-contract standard callback, no state side effects.
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // ------------------------------------------------------------------ //
    //                        Execution entry                            //
    // ------------------------------------------------------------------ //

    /// @notice Execute one call with a single passkey signature (the relayer may pay gas).
    function execute(address to, uint256 value, bytes calldata data, WebAuthn.Assertion calldata assertion) external {
        bytes32 challenge = _challengeSingle(nonce, to, value, keccak256(data));
        _verify(challenge, assertion);
        nonce += 1;
        (bool ok,) = to.call{value: value}(data);
        if (!ok) revert CallFailed(0);
        emit Executed(to, value, nonce);
    }

    /// @notice Atomically execute a batch of calls with a single passkey signature.
    ///         Designer Hub's "import scheme" flow uses it to complete attest + mint with one signature.
    function executeBatch(
        address[] calldata to,
        uint256[] calldata value,
        bytes[] calldata data,
        WebAuthn.Assertion calldata assertion
    ) external {
        if (to.length != value.length || to.length != data.length) revert BatchLengthMismatch();
        bytes32[] memory dataHashes = new bytes32[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            dataHashes[i] = keccak256(data[i]);
        }
        bytes32 challenge = _challengeBatch(nonce, keccak256(abi.encode(to, value, dataHashes)));
        _verify(challenge, assertion);
        nonce += 1;
        for (uint256 i = 0; i < to.length; i++) {
            (bool ok,) = to[i].call{value: value[i]}(data[i]);
            if (!ok) revert CallFailed(i);
        }
        emit BatchExecuted(to.length, nonce);
    }

    // ------------------------------------------------------------------ //
    //                          Key management                           //
    // ------------------------------------------------------------------ //

    /// @notice Append a passkey public key (multi-device recovery). Callable only via the account's own execute.
    function addKey(uint256 x, uint256 y) external {
        if (msg.sender != address(this)) revert InvalidSignature();
        if (_keys.length >= MAX_KEYS) revert TooManyKeys();
        if (!P256.onCurve(x, y)) revert InvalidPublicKey();
        _keys.push([x, y]);
        emit KeyAdded(_keys.length - 1, x, y);
    }

    /// @notice Number of registered public keys.
    function keyCount() external view returns (uint256) {
        return _keys.length;
    }

    /// @notice The public key at index.
    function keyAt(uint256 index) external view returns (uint256 x, uint256 y) {
        (x, y) = (_keys[index][0], _keys[index][1]);
    }

    // ------------------------------------------------------------------ //
    //                    Challenge derivation (overridable)              //
    // ------------------------------------------------------------------ //

    /// @notice Challenge preview: the web app / SDK compute it offline with the same formula, for the browser to request a signature.
    function challengePreview(uint256 n, address to, uint256 value, bytes32 dataHash) external view returns (bytes32) {
        return _challengeSingle(n, to, value, dataHash);
    }

    function _challengeSingle(uint256 n, address to, uint256 value, bytes32 dataHash)
        internal
        view
        virtual
        returns (bytes32)
    {
        // domain-separation prefix + account address + chain id + nonce + target + value + calldata hash
        return keccak256(abi.encodePacked("dh/passkey/tx", address(this), block.chainid, n, to, value, dataHash));
    }

    function _challengeBatch(uint256 n, bytes32 batchHash) internal view virtual returns (bytes32) {
        return keccak256(abi.encodePacked("dh/passkey/batch", address(this), block.chainid, n, batchHash));
    }

    // ------------------------------------------------------------------ //
    //                       Signature core                              //
    // ------------------------------------------------------------------ //

    function _verify(bytes32 challenge, WebAuthn.Assertion calldata assertion) internal view {
        // origin check (optional: enabled when originHash is non-zero)
        if (originHash != bytes32(0)) {
            (bytes memory origin, bool ok) = _originOf(assertion.clientDataJSON);
            if (!ok || keccak256(origin) != originHash) revert BadOrigin();
        }
        bool valid = false;
        for (uint256 i = 0; i < _keys.length && !valid; i++) {
            valid = WebAuthn.verify(
                WebAuthn.Assertion({
                    authenticatorData: assertion.authenticatorData,
                    clientDataJSON: assertion.clientDataJSON,
                    r: assertion.r,
                    s: assertion.s
                }),
                challenge,
                rpIdHash,
                _keys[i][0],
                _keys[i][1]
            );
        }
        if (!valid) revert InvalidSignature();
    }

    function _originOf(bytes calldata clientDataJSON) private pure returns (bytes memory, bool) {
        // Reuse the WebAuthn library's JSON extraction logic (after converting calldata → memory, locate the "origin" field)
        bytes memory cd = abi.encodePacked(clientDataJSON);
        return WebAuthn.extractJsonString(cd, "origin");
    }
}

/// @title PasskeyAccountFactory — CREATE2 deterministic deployment of passkey accounts
/// @notice salt = keccak256(abi.encode(x, y, rpIdHash, originHash)):
///         the same passkey under the same site configuration always maps to the same address (counterfactual),
///         so the registration page can show the address to the user before deployment.
contract PasskeyAccountFactory {
    error CreateFailed();
    error AccountExists(address account);

    event AccountCreated(address indexed account, uint256 x, uint256 y);

    /// @notice Precompute the account address for a public key (without deploying).
    function accountOf(uint256 x, uint256 y, bytes32 rpIdHash, bytes32 originHash) external view returns (address) {
        return _compute(x, y, rpIdHash, originHash);
    }

    /// @notice Deploy an account. Reverts if it already exists (callers should check with accountOf first).
    function createAccount(uint256 x, uint256 y, bytes32 rpIdHash, bytes32 originHash)
        external
        returns (P256PasskeyAccount account)
    {
        address expected = _compute(x, y, rpIdHash, originHash);
        if (expected.code.length != 0) revert AccountExists(expected);
        bytes memory initCode =
            abi.encodePacked(type(P256PasskeyAccount).creationCode, abi.encode(x, y, rpIdHash, originHash));
        bytes32 salt = keccak256(abi.encode(x, y, rpIdHash, originHash));
        address deployed;
        assembly {
            deployed := create2(0, add(initCode, 32), mload(initCode), salt)
        }
        if (deployed == address(0)) revert CreateFailed();
        account = P256PasskeyAccount(payable(deployed));
        emit AccountCreated(deployed, x, y);
    }

    function _compute(uint256 x, uint256 y, bytes32 rpIdHash, bytes32 originHash)
        private
        view
        returns (address predicted)
    {
        bytes memory initCode =
            abi.encodePacked(type(P256PasskeyAccount).creationCode, abi.encode(x, y, rpIdHash, originHash));
        bytes32 salt = keccak256(abi.encode(x, y, rpIdHash, originHash));
        predicted = address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(initCode)))))
        );
    }
}
