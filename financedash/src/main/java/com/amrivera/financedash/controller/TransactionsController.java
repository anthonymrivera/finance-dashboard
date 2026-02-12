package com.amrivera.financedash.controller;

import com.amrivera.financedash.controller.dto.TransactionRequest;
import com.amrivera.financedash.controller.dto.TransactionResponse;
import com.amrivera.financedash.model.Account;
import com.amrivera.financedash.model.Transaction;
import com.amrivera.financedash.model.User;
import com.amrivera.financedash.repository.AccountRepository;
import com.amrivera.financedash.repository.TransactionRepository;
import com.amrivera.financedash.repository.UserRepository;
import com.amrivera.financedash.service.TransactionService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/transactions")
public class TransactionsController {

    private static final Logger log = LoggerFactory.getLogger(TransactionsController.class);

    private final TransactionService transactionService;
    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;

    public TransactionsController(TransactionRepository transactionRepository,
                                  TransactionService transactionService,
                                  AccountRepository accountRepository,
                                  UserRepository userRepository) {
        this.transactionRepository = transactionRepository;
        this.transactionService = transactionService;
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
    }

    /**
     * Get current authenticated user
     */
    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext()
                .getAuthentication()
                .getName();

        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));
    }

    /**
     * Verify that the account belongs to the current user
     */
    private boolean isAccountOwnedByCurrentUser(Long accountId) {
        User currentUser = getCurrentUser();
        return accountRepository.findById(accountId)
                .map(account -> account.getUser() != null &&
                        account.getUser().getId().equals(currentUser.getId()))
                .orElse(false);
    }

    /**
     * GET /api/transactions?accountId={id}
     * Returns transactions ONLY if the account belongs to the current user
     */
    @GetMapping
    public ResponseEntity<List<TransactionResponse>> list(@RequestParam Long accountId) {
        // 🔒 SECURITY CHECK: Verify ownership before returning data
        if (!isAccountOwnedByCurrentUser(accountId)) {
            log.warn("Unauthorized access attempt to accountId: {} by user: {}",
                    accountId, getCurrentUser().getUsername());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<TransactionResponse> transactions = transactionRepository
                .findByAccountIdOrderByTxDateDesc(accountId)
                .stream()
                .map(this::toResponse)
                .toList();

        return ResponseEntity.ok(transactions);
    }

    /**
     * POST /api/transactions
     * Creates a transaction ONLY if the account belongs to the current user
     */
    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody TransactionRequest req) {
        // 🔒 SECURITY CHECK: Verify ownership before creating transaction
        if (!isAccountOwnedByCurrentUser(req.getAccountId())) {
            log.warn("Unauthorized transaction creation attempt for accountId: {} by user: {}",
                    req.getAccountId(), getCurrentUser().getUsername());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("You don't have permission to create transactions for this account");
        }

        try {
            Transaction saved = transactionService.create(req);
            TransactionResponse resp = toResponse(saved);

            log.info("Transaction created: {} for account: {} by user: {}",
                    saved.getId(), req.getAccountId(), getCurrentUser().getUsername());

            return ResponseEntity
                    .created(URI.create("/api/transactions/" + saved.getId()))
                    .body(resp);
        } catch (IllegalArgumentException e) {
            log.error("Failed to create transaction: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Convert Transaction entity to DTO
     */
    private TransactionResponse toResponse(Transaction t) {
        TransactionResponse r = new TransactionResponse();
        r.id = t.getId();
        r.accountId = t.getAccountId();
        r.amount = t.getAmount();
        r.description = t.getDescription();
        r.category = t.getCategory();
        r.txDate = t.getTxDate();
        r.txType = t.getTxType();
        return r;
    }
}