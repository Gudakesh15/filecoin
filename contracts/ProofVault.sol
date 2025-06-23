// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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