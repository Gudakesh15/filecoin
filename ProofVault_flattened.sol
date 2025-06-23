// Sources flattened with hardhat v2.24.3 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v5.3.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v5.3.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @openzeppelin/contracts/utils/ReentrancyGuard.sol@v5.3.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}


// File contracts/ProofVault.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.20;


/**
 * @title ProofVault
 * @dev A decentralized document vault for registering and verifying documents on Filecoin
 * @author ProofVault Team
 */
contract ProofVault is Ownable, ReentrancyGuard {
    
    // ========== DATA STRUCTURES ==========
    
    /**
     * @dev Document metadata structure
     * @param owner Address of the document owner
     * @param tag User-defined tag for document categorization
     * @param timestamp When the document was registered
     * @param exists Whether this document exists (for efficient checking)
     */
    struct DocumentMetadata {
        address owner;
        string tag;
        uint256 timestamp;
        bool exists;
    }
    
    /**
     * @dev Verification record structure
     * @param verifier Address of the verifier
     * @param verifierName Human-readable name of the verifier
     * @param timestamp When the verification occurred
     */
    struct Verification {
        address verifier;
        string verifierName;
        uint256 timestamp;
    }
    
    // ========== STORAGE MAPPINGS ==========
    
    /// @dev Maps user address to array of their document CIDs
    mapping(address => string[]) private userDocuments;
    
    /// @dev Maps CID to its document metadata
    mapping(string => DocumentMetadata) private documents;
    
    /// @dev Maps CID to array of verification records
    mapping(string => Verification[]) private documentVerifications;
    
    /// @dev Maps CID to quick verification status lookup
    mapping(string => bool) private isVerified;
    
    /// @dev Maps CID to prevent duplicate registrations
    mapping(string => bool) private cidExists;
    
    // ========== ACCESS CONTROL ==========
    
    /// @dev Mapping to track authorized verifiers
    mapping(address => bool) private authorizedVerifiers;
    
    /// @dev Event emitted when a verifier is authorized or deauthorized
    event VerifierStatusChanged(address indexed verifier, bool authorized);
    
    // ========== EVENTS ==========
    
    /**
     * @dev Emitted when a document is registered
     * @param user Address of the document owner
     * @param cid IPFS Content Identifier of the document
     * @param tag User-defined tag for the document
     * @param timestamp When the registration occurred
     */
    event DocumentRegistered(
        address indexed user, 
        string cid, 
        string tag, 
        uint256 timestamp
    );
    
    /**
     * @dev Emitted when a document is verified
     * @param cid IPFS Content Identifier of the verified document
     * @param verifier Address of the verifier
     * @param verifierName Human-readable name of the verifier
     * @param timestamp When the verification occurred
     */
    event DocumentVerified(
        string indexed cid, 
        address indexed verifier, 
        string verifierName, 
        uint256 timestamp
    );
    
    // ========== CONSTRUCTOR ==========
    
    /**
     * @dev Initialize the ProofVault contract
     * @param initialOwner Address that will become the initial owner
     */
    constructor(address initialOwner) Ownable(initialOwner) {}
    
    // ========== CORE FUNCTIONS ==========
    
    /**
     * @dev Register a new document with its CID and tag
     * @param cid IPFS Content Identifier of the document
     * @param tag User-defined tag for document categorization
     */
    function registerDocument(string calldata cid, string calldata tag) 
        external 
        nonReentrant 
    {
        // Input validation
        require(bytes(cid).length > 0, "CID cannot be empty");
        require(bytes(tag).length > 0, "Tag cannot be empty");
        require(!cidExists[cid], "Document already registered");
        
        // Store document metadata
        documents[cid] = DocumentMetadata({
            owner: msg.sender,
            tag: tag,
            timestamp: block.timestamp,
            exists: true
        });
        
        // Add to user's document list
        userDocuments[msg.sender].push(cid);
        
        // Mark CID as existing to prevent duplicates
        cidExists[cid] = true;
        
        // Emit event for frontend/indexing
        emit DocumentRegistered(msg.sender, cid, tag, block.timestamp);
    }
    
    /**
     * @dev Verify a document (restricted to owner or authorized verifiers)
     * @param cid IPFS Content Identifier of the document to verify
     * @param verifierName Human-readable name of the verifier
     */
    function verifyDocument(string calldata cid, string calldata verifierName) 
        external 
        onlyVerifier 
        nonReentrant 
    {
        // Input validation
        require(bytes(cid).length > 0, "CID cannot be empty");
        require(bytes(verifierName).length > 0, "Verifier name cannot be empty");
        require(documents[cid].exists, "Document not registered");
        
        // Create verification record
        documentVerifications[cid].push(Verification({
            verifier: msg.sender,
            verifierName: verifierName,
            timestamp: block.timestamp
        }));
        
        // Mark as verified
        isVerified[cid] = true;
        
        // Emit event for frontend/indexing
        emit DocumentVerified(cid, msg.sender, verifierName, block.timestamp);
    }
    
    /**
     * @dev Get a specific document CID from a user's document list
     * @param user Address of the document owner
     * @param index Index in the user's document array
     * @return The CID at the specified index
     */
    function getDocument(address user, uint256 index) 
        external 
        view 
        returns (string memory) 
    {
        require(index < userDocuments[user].length, "Index out of bounds");
        return userDocuments[user][index];
    }
    
    /**
     * @dev Get the number of documents owned by a user
     * @param user Address of the document owner
     * @return Number of documents owned by the user
     */
    function getUserDocumentCount(address user) 
        external 
        view 
        returns (uint256) 
    {
        return userDocuments[user].length;
    }
    
    /**
     * @dev Get all verification records for a document
     * @param cid IPFS Content Identifier of the document
     * @return Array of verification records
     */
    function getDocumentVerifications(string calldata cid) 
        external 
        view 
        returns (Verification[] memory) 
    {
        return documentVerifications[cid];
    }
    
    /**
     * @dev Check if a document has been verified
     * @param cid IPFS Content Identifier of the document
     * @return True if the document has been verified
     */
    function isDocumentVerified(string calldata cid) 
        external 
        view 
        returns (bool) 
    {
        return isVerified[cid];
    }
    
    /**
     * @dev Get document metadata
     * @param cid IPFS Content Identifier of the document
     * @return Document metadata including owner, tag, and timestamp
     */
    function getDocumentMetadata(string calldata cid) 
        external 
        view 
        returns (DocumentMetadata memory) 
    {
        require(documents[cid].exists, "Document not registered");
        return documents[cid];
    }
    
    /**
     * @dev Get all documents owned by a user
     * @param user Address of the document owner
     * @return Array of CIDs owned by the user
     */
    function getUserDocuments(address user) 
        external 
        view 
        returns (string[] memory) 
    {
        return userDocuments[user];
    }
    
    /**
     * @dev Add an authorized verifier (only owner can do this)
     * @param verifier Address to authorize as a verifier
     */
    function addVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "Invalid verifier address");
        require(!authorizedVerifiers[verifier], "Verifier already authorized");
        
        authorizedVerifiers[verifier] = true;
        emit VerifierStatusChanged(verifier, true);
    }
    
    /**
     * @dev Remove an authorized verifier (only owner can do this)
     * @param verifier Address to deauthorize as a verifier
     */
    function removeVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "Invalid verifier address");
        require(authorizedVerifiers[verifier], "Verifier not authorized");
        
        authorizedVerifiers[verifier] = false;
        emit VerifierStatusChanged(verifier, false);
    }
    
    /**
     * @dev Check if an address is an authorized verifier
     * @param verifier Address to check
     * @return True if the address is an authorized verifier
     */
    function isAuthorizedVerifier(address verifier) external view returns (bool) {
        return authorizedVerifiers[verifier];
    }
    
    /**
     * @dev Modifier to restrict access to owner or authorized verifiers
     */
    modifier onlyVerifier() {
        require(
            msg.sender == owner() || authorizedVerifiers[msg.sender],
            "Caller is not owner or authorized verifier"
        );
        _;
    }
    
    /**
     * @dev Allow document owner to self-verify their document
     * @param cid IPFS Content Identifier of the document to verify
     * @param verifierName Human-readable name for the self-verification
     */
    function selfVerifyDocument(string calldata cid, string calldata verifierName) 
        external 
        nonReentrant 
    {
        // Input validation
        require(bytes(cid).length > 0, "CID cannot be empty");
        require(bytes(verifierName).length > 0, "Verifier name cannot be empty");
        require(documents[cid].exists, "Document not registered");
        require(documents[cid].owner == msg.sender, "Only document owner can self-verify");
        
        // Create verification record
        documentVerifications[cid].push(Verification({
            verifier: msg.sender,
            verifierName: verifierName,
            timestamp: block.timestamp
        }));
        
        // Mark as verified
        isVerified[cid] = true;
        
        // Emit event for frontend/indexing
        emit DocumentVerified(cid, msg.sender, verifierName, block.timestamp);
    }
}
