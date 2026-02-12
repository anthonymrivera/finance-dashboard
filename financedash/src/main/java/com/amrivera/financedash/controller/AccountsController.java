package com.amrivera.financedash.controller;

import com.amrivera.financedash.model.Account;
import com.amrivera.financedash.model.User;
import com.amrivera.financedash.repository.AccountRepository;
import com.amrivera.financedash.repository.TransactionRepository;
import com.amrivera.financedash.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
@CrossOrigin(origins = {"http://127.0.0.1:5173", "http://localhost:5173"})
public class AccountsController {

    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    public AccountsController(AccountRepository accountRepository,
                              UserRepository userRepository, TransactionRepository transactionRepository) {
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
    }

    // Helper: current User from JWT / SecurityContext
    private User getCurrentUser() {
        String username = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));
    }

    // GET /api/accounts – only this user's accounts
    @GetMapping
    public List<Account> getAccounts() {
        User current = getCurrentUser();
        return accountRepository.findByUserId(current.getId());
    }

    // POST /api/accounts – create account for current user
    @PostMapping
    public ResponseEntity<Account> createAccount(@RequestBody Account account) {
        User current = getCurrentUser();

        account.setId(null);           // force insert
        account.setUser(current);      // OWNERSHIP: tie to logged-in user

        Account saved = accountRepository.save(account);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // PUT /api/accounts/{id} – update only if belongs to current user
    @PutMapping("/{id}")
    public ResponseEntity<Account> updateAccount(@PathVariable Long id,
                                                 @RequestBody Account updated) {
        User current = getCurrentUser();

        return accountRepository.findById(id)
                .filter(acc -> acc.getUser() != null &&
                        acc.getUser().getId().equals(current.getId()))
                .map(acc -> {
                    acc.setName(updated.getName());
                    acc.setType(updated.getType());
                    acc.setBalance(updated.getBalance());
                    Account saved = accountRepository.save(acc);
                    return ResponseEntity.ok(saved);
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.FORBIDDEN).build());
    }

    // DELETE /api/accounts/{id} – delete only if belongs to current user
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAccount(@PathVariable Long id) {
        User current = getCurrentUser();

        return accountRepository.findById(id)
                .filter(acc -> acc.getUser() != null && acc.getUser().getId().equals(current.getId()))
                .map(acc -> {
                    long txCount = transactionRepository.countByAccountId(acc.getId());
                    if (txCount > 0) {
                        return ResponseEntity
                                .badRequest()
                                .body("Cannot delete account: it has " + txCount + " transaction(s). Delete transactions first.");
                    }

                    accountRepository.delete(acc);
                    return ResponseEntity.noContent().build();
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.FORBIDDEN).build());
    }
}
