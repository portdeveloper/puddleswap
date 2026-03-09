// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IRegistrationGate} from "./IRegistrationGate.sol";

interface IBasicRegistrationCallback {
    function onBasicTokenRemoved(address registrant) external;
}

contract TokenRegistry is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    uint256 public constant MAX_QUERY_LENGTH = 4;
    uint256 public constant SEARCH_LIMIT = 6;

    enum TokenLevel {
        BASIC,
        CHECKMARK,
        TOP_VERIFIED
    }

    struct TokenInfo {
        bool exists;
        bool active;
        bool isCore;
        uint8 decimals;
        TokenLevel level;
        address registrant;
        string symbol;
        string normalizedSymbol;
        string name;
        string imageURI;
    }

    struct TokenView {
        address token;
        string symbol;
        string name;
        uint8 decimals;
        TokenLevel level;
        string imageURI;
        bool isCore;
        bool active;
    }

    IRegistrationGate public registrationGate;

    mapping(address => TokenInfo) private _tokens;
    mapping(uint8 => mapping(bytes32 => address[])) private _buckets;

    address[] private _coreTokens;
    mapping(address => uint256) private _coreIndexPlusOne;

    event RegistrationGateUpdated(address indexed oldGate, address indexed newGate);
    event BasicRegistered(address indexed registrant, address indexed token, string symbol, string name, uint8 decimals);
    event VerifiedRegistered(
        address indexed verifier,
        address indexed token,
        string symbol,
        string name,
        uint8 decimals,
        TokenLevel level,
        bool isCore
    );
    event TokenLevelUpdated(address indexed token, TokenLevel previousLevel, TokenLevel newLevel);
    event TokenImageUpdated(address indexed token, string imageURI);
    event TokenCoreUpdated(address indexed token, bool isCore);
    event TokenActivityUpdated(address indexed token, bool active);

    error TokenAlreadyRegistered(address token);
    error TokenNotRegistered(address token);
    error TokenAlreadyInState(address token, bool active);
    error InvalidTokenAddress();
    error InvalidLevel(uint8 level);
    error InvalidSymbolLength();
    error InvalidNameLength();
    error InvalidQueryLength();
    error UnsupportedSymbolCharacter(uint8 charCode);
    error BasicTokenCannotSetImage();

    constructor(address admin_, address verifier_, address registrationGate_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(VERIFIER_ROLE, verifier_);
        registrationGate = IRegistrationGate(registrationGate_);
    }

    function setRegistrationGate(address registrationGate_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        address oldGate = address(registrationGate);
        registrationGate = IRegistrationGate(registrationGate_);
        emit RegistrationGateUpdated(oldGate, registrationGate_);
    }

    function registerBasic(address token, string calldata symbol, string calldata name, uint8 decimals) external {
        if (token == address(0)) {
            revert InvalidTokenAddress();
        }
        if (_tokens[token].exists) {
            revert TokenAlreadyRegistered(token);
        }

        string memory normalizedSymbol = _normalizeSymbol(symbol, false);
        _validateName(name);

        address gate = address(registrationGate);
        if (gate != address(0)) {
            registrationGate.authorizeAndConsume(msg.sender, token);
        }

        _tokens[token] = TokenInfo({
            exists: true,
            active: true,
            isCore: false,
            decimals: decimals,
            level: TokenLevel.BASIC,
            registrant: msg.sender,
            symbol: symbol,
            normalizedSymbol: normalizedSymbol,
            name: name,
            imageURI: ""
        });

        _insertTokenIntoIndexes(token, TokenLevel.BASIC, normalizedSymbol);

        emit BasicRegistered(msg.sender, token, symbol, name, decimals);
    }

    function registerVerified(
        address token,
        string calldata symbol,
        string calldata name,
        uint8 decimals,
        TokenLevel level,
        bool isCore,
        string calldata imageURI
    ) external onlyRole(VERIFIER_ROLE) {
        if (token == address(0)) {
            revert InvalidTokenAddress();
        }
        if (_tokens[token].exists) {
            revert TokenAlreadyRegistered(token);
        }
        if (level == TokenLevel.BASIC) {
            revert InvalidLevel(uint8(level));
        }

        string memory normalizedSymbol = _normalizeSymbol(symbol, false);
        _validateName(name);

        _tokens[token] = TokenInfo({
            exists: true,
            active: true,
            isCore: isCore,
            decimals: decimals,
            level: level,
            registrant: address(0),
            symbol: symbol,
            normalizedSymbol: normalizedSymbol,
            name: name,
            imageURI: imageURI
        });

        _insertTokenIntoIndexes(token, level, normalizedSymbol);
        _setCore(token, isCore);

        emit VerifiedRegistered(msg.sender, token, symbol, name, decimals, level, isCore);
    }

    function setTokenLevel(address token, TokenLevel newLevel) external onlyRole(VERIFIER_ROLE) {
        TokenInfo storage info = _getToken(token);
        TokenLevel previousLevel = info.level;

        if (previousLevel == newLevel) {
            return;
        }

        if (info.active) {
            _removeTokenFromIndexes(token, previousLevel, info.normalizedSymbol);
        }

        info.level = newLevel;
        if (newLevel == TokenLevel.BASIC) {
            info.imageURI = "";
        }

        if (info.active) {
            _insertTokenIntoIndexes(token, newLevel, info.normalizedSymbol);
        }

        emit TokenLevelUpdated(token, previousLevel, newLevel);
    }

    function setImageURI(address token, string calldata imageURI) external onlyRole(VERIFIER_ROLE) {
        TokenInfo storage info = _getToken(token);
        if (info.level == TokenLevel.BASIC) {
            revert BasicTokenCannotSetImage();
        }

        info.imageURI = imageURI;
        emit TokenImageUpdated(token, imageURI);
    }

    function setCore(address token, bool isCore) external onlyRole(VERIFIER_ROLE) {
        _getToken(token);
        _setCore(token, isCore);
    }

    function setTokenActive(address token, bool active) external onlyRole(VERIFIER_ROLE) {
        _setTokenActive(token, active);
    }

    function removeToken(address token) external onlyRole(VERIFIER_ROLE) {
        _setTokenActive(token, false);
    }

    function _setTokenActive(address token, bool active) private {
        TokenInfo storage info = _getToken(token);
        if (info.active == active) {
            revert TokenAlreadyInState(token, active);
        }

        if (active) {
            info.active = true;
            _insertTokenIntoIndexes(token, info.level, info.normalizedSymbol);

            if (info.isCore) {
                _setCore(token, true);
            }
        } else {
            info.active = false;
            _removeTokenFromIndexes(token, info.level, info.normalizedSymbol);
            _setCore(token, false);

            if (info.level == TokenLevel.BASIC && info.registrant != address(0)) {
                _notifyGateTokenRemoved(info.registrant);
            }
        }

        emit TokenActivityUpdated(token, active);
    }

    function getToken(address token) external view returns (TokenView memory) {
        TokenInfo storage info = _tokens[token];
        if (!info.exists) {
            revert TokenNotRegistered(token);
        }

        return _toTokenView(token, info);
    }

    function search(string calldata query) external view returns (TokenView[] memory) {
        string memory normalizedQuery = _normalizeSymbol(query, true);
        bytes32 key = _prefixKey(bytes(normalizedQuery), bytes(normalizedQuery).length);

        TokenView[] memory result = new TokenView[](SEARCH_LIMIT);
        uint256 count;

        TokenLevel[3] memory searchOrder = [TokenLevel.TOP_VERIFIED, TokenLevel.CHECKMARK, TokenLevel.BASIC];

        for (uint256 i = 0; i < searchOrder.length && count < SEARCH_LIMIT; i++) {
            address[] storage bucket = _buckets[uint8(searchOrder[i])][key];
            for (uint256 j = 0; j < bucket.length && count < SEARCH_LIMIT; j++) {
                address token = bucket[j];
                TokenInfo storage info = _tokens[token];
                if (!info.active) {
                    continue;
                }

                result[count] = _toTokenView(token, info);
                count++;
            }
        }

        TokenView[] memory trimmed = new TokenView[](count);
        for (uint256 i = 0; i < count; i++) {
            trimmed[i] = result[i];
        }

        return trimmed;
    }

    function listCoreTokens() external view returns (address[] memory) {
        return _coreTokens;
    }

    function _getToken(address token) private view returns (TokenInfo storage info) {
        info = _tokens[token];
        if (!info.exists) {
            revert TokenNotRegistered(token);
        }
    }

    function _toTokenView(address token, TokenInfo storage info) private view returns (TokenView memory) {
        string memory image = info.level == TokenLevel.BASIC ? "" : info.imageURI;

        return TokenView({
            token: token,
            symbol: info.symbol,
            name: info.name,
            decimals: info.decimals,
            level: info.level,
            imageURI: image,
            isCore: info.isCore,
            active: info.active
        });
    }

    function _setCore(address token, bool isCore) private {
        TokenInfo storage info = _tokens[token];
        bool inCoreList = _coreIndexPlusOne[token] != 0;
        info.isCore = isCore;

        if (isCore && info.active) {
            if (!inCoreList) {
                _coreTokens.push(token);
                _coreIndexPlusOne[token] = _coreTokens.length;
            }
        } else {
            if (inCoreList) {
                uint256 indexPlusOne = _coreIndexPlusOne[token];
                uint256 index = indexPlusOne - 1;
                uint256 lastIndex = _coreTokens.length - 1;

                if (index != lastIndex) {
                    address moved = _coreTokens[lastIndex];
                    _coreTokens[index] = moved;
                    _coreIndexPlusOne[moved] = index + 1;
                }

                _coreTokens.pop();
                _coreIndexPlusOne[token] = 0;
            }
        }

        emit TokenCoreUpdated(token, isCore);
    }

    function _insertTokenIntoIndexes(address token, TokenLevel level, string memory normalizedSymbol) private {
        bytes memory symbolBytes = bytes(normalizedSymbol);
        uint256 maxPrefix = symbolBytes.length;
        if (maxPrefix > MAX_QUERY_LENGTH) {
            maxPrefix = MAX_QUERY_LENGTH;
        }

        for (uint256 prefixLength = 0; prefixLength <= maxPrefix; prefixLength++) {
            bytes32 key = _prefixKey(symbolBytes, prefixLength);
            _insertIntoBucket(level, key, token);
        }
    }

    function _removeTokenFromIndexes(address token, TokenLevel level, string memory normalizedSymbol) private {
        bytes memory symbolBytes = bytes(normalizedSymbol);
        uint256 maxPrefix = symbolBytes.length;
        if (maxPrefix > MAX_QUERY_LENGTH) {
            maxPrefix = MAX_QUERY_LENGTH;
        }

        for (uint256 prefixLength = 0; prefixLength <= maxPrefix; prefixLength++) {
            bytes32 key = _prefixKey(symbolBytes, prefixLength);
            _removeFromBucket(level, key, token);
        }
    }

    function _insertIntoBucket(TokenLevel level, bytes32 key, address token) private {
        address[] storage bucket = _buckets[uint8(level)][key];

        uint256 length = bucket.length;
        bucket.push(token);

        uint256 index = length;
        while (index > 0) {
            address previous = bucket[index - 1];
            if (!_comesBefore(token, previous)) {
                break;
            }

            bucket[index] = previous;
            index--;
        }

        bucket[index] = token;
    }

    function _removeFromBucket(TokenLevel level, bytes32 key, address token) private {
        address[] storage bucket = _buckets[uint8(level)][key];

        for (uint256 i = 0; i < bucket.length; i++) {
            if (bucket[i] == token) {
                uint256 lastIndex = bucket.length - 1;
                for (uint256 j = i; j < lastIndex; j++) {
                    bucket[j] = bucket[j + 1];
                }
                bucket.pop();
                return;
            }
        }
    }

    function _comesBefore(address lhs, address rhs) private view returns (bool) {
        bytes memory lhsSymbol = bytes(_tokens[lhs].normalizedSymbol);
        bytes memory rhsSymbol = bytes(_tokens[rhs].normalizedSymbol);

        uint256 minLength = lhsSymbol.length < rhsSymbol.length ? lhsSymbol.length : rhsSymbol.length;
        for (uint256 i = 0; i < minLength; i++) {
            if (lhsSymbol[i] < rhsSymbol[i]) {
                return true;
            }
            if (lhsSymbol[i] > rhsSymbol[i]) {
                return false;
            }
        }

        if (lhsSymbol.length != rhsSymbol.length) {
            return lhsSymbol.length < rhsSymbol.length;
        }

        return lhs < rhs;
    }

    function _prefixKey(bytes memory normalizedSymbol, uint256 prefixLength) private pure returns (bytes32) {
        if (prefixLength == 0) {
            return keccak256(bytes(""));
        }

        bytes memory prefix = new bytes(prefixLength);
        for (uint256 i = 0; i < prefixLength; i++) {
            prefix[i] = normalizedSymbol[i];
        }

        return keccak256(prefix);
    }

    function _normalizeSymbol(string memory value, bool allowEmpty) private pure returns (string memory) {
        bytes memory input = bytes(value);
        if (!allowEmpty && (input.length == 0 || input.length > 15)) {
            revert InvalidSymbolLength();
        }
        if (allowEmpty && input.length > MAX_QUERY_LENGTH) {
            revert InvalidQueryLength();
        }

        bytes memory normalized = new bytes(input.length);

        for (uint256 i = 0; i < input.length; i++) {
            uint8 charCode = uint8(input[i]);

            if (charCode >= 97 && charCode <= 122) {
                normalized[i] = bytes1(charCode - 32);
            } else if ((charCode >= 65 && charCode <= 90) || (charCode >= 48 && charCode <= 57) || charCode == 45 || charCode == 95) {
                normalized[i] = bytes1(charCode);
            } else {
                revert UnsupportedSymbolCharacter(charCode);
            }
        }

        return string(normalized);
    }

    function _validateName(string memory name) private pure {
        if (bytes(name).length == 0) {
            revert InvalidNameLength();
        }
    }

    function _notifyGateTokenRemoved(address registrant) private {
        address gate = address(registrationGate);
        if (gate == address(0)) {
            return;
        }

        try IBasicRegistrationCallback(gate).onBasicTokenRemoved(registrant) {} catch {}
    }
}
