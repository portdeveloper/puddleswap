// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract RegistrationPass is ERC721Enumerable, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant CONSUMER_ROLE = keccak256("CONSUMER_ROLE");

    uint256 private _nextTokenId = 1;

    mapping(uint256 => uint64) public expiresAt;

    event PassMinted(address indexed to, uint256 indexed tokenId, uint64 expiresAt);
    event PassConsumed(uint256 indexed tokenId);

    error PassExpired(uint256 tokenId);
    error NoValidPass(address owner);
    error InvalidExpiration();

    constructor(address admin_) ERC721("Token Registration Pass", "TRP") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ISSUER_ROLE, admin_);
    }

    function mintPass(address to, uint64 expiresAtTimestamp) external onlyRole(ISSUER_ROLE) returns (uint256 tokenId) {
        if (expiresAtTimestamp <= block.timestamp) {
            revert InvalidExpiration();
        }
        tokenId = _nextTokenId;
        _nextTokenId = tokenId + 1;

        expiresAt[tokenId] = expiresAtTimestamp;
        _safeMint(to, tokenId);

        emit PassMinted(to, tokenId, expiresAtTimestamp);
    }

    function consume(uint256 tokenId) external onlyRole(CONSUMER_ROLE) {
        uint64 expiration = expiresAt[tokenId];
        if (expiration < block.timestamp) {
            revert PassExpired(tokenId);
        }

        delete expiresAt[tokenId];
        _burn(tokenId);

        emit PassConsumed(tokenId);
    }

    function firstValidPass(address owner) external view returns (bool found, uint256 tokenId) {
        uint256 ownerBalance = balanceOf(owner);
        uint256 timestamp = block.timestamp;

        for (uint256 i = 0; i < ownerBalance; i++) {
            uint256 candidate = tokenOfOwnerByIndex(owner, i);
            if (expiresAt[candidate] >= timestamp) {
                return (true, candidate);
            }
        }

        return (false, 0);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
