package com.amrivera.financedash.service;

import com.amrivera.financedash.model.Account;
import com.amrivera.financedash.model.User;
import com.amrivera.financedash.repository.AccountRepository;
import com.amrivera.financedash.repository.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class AccountService {

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;

    public AccountService(AccountRepository accountRepository,
                          TransactionRepository transactionRepository) {
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
    }

    /**
     * Get all accounts for a specific user
     */
    @Transactional(readOnly = true)
    public List<Account> getAccountsByUser(User user) {
        log.debug("Fetching accounts for user: {}", user.getUsername());
        return accountRepository.findByUserId(user.getId());
    }

    /**
     * Create a new account for a user
     */
    @Transactional
    public Account createAccount(Account account, User user) {
        log.info("Creating new account for user: {}", user.getUsername());

        account.setId(null); // Ensure new account
        account.setUser(user);

        Account saved = accountRepository.save(account);
        log.info("Account created with ID: {} for user: {}", saved.getId(), user.getUsername());

        return saved;
    }

    /**
     * Update an account - only if it belongs to the user
     */
    @Transactional
    public Optional<Account> updateAccount(Long accountId, Account updatedData, User currentUser) {
        return accountRepository.findById(accountId)
                .filter(existing -> belongsToUser(existing, currentUser))
                .map(existing -> {
                    log.info("Updating account ID: {} for user: {}", accountId, currentUser.getUsername());

                    existing.setName(updatedData.getName());
                    existing.setType(updatedData.getType());
                    existing.setBalance(updatedData.getBalance());

                    return accountRepository.save(existing);
                });
    }

    /**
     * Delete an account - only if it belongs to the user and has no transactions
     */
    @Transactional
    public boolean deleteAccount(Long accountId, User currentUser) {
        return accountRepository.findById(accountId)
                .filter(account -> belongsToUser(account, currentUser))
                .map(account -> {
                    long txCount = transactionRepository.countByAccountId(accountId);

                    if (txCount > 0) {
                        log.warn("Cannot delete account ID: {} - has {} transactions", accountId, txCount);
                        throw new IllegalStateException(
                                "Cannot delete account with existing transactions. " +
                                        "Please delete all " + txCount + " transaction(s) first."
                        );
                    }

                    log.info("Deleting account ID: {} for user: {}", accountId, currentUser.getUsername());
                    accountRepository.delete(account);
                    return true;
                })
                .orElse(false);
    }

    /**
     * Find an account by ID if it belongs to the user
     */
    @Transactional(readOnly = true)
    public Optional<Account> findAccountByIdAndUser(Long accountId, User user) {
        return accountRepository.findById(accountId)
                .filter(account -> belongsToUser(account, user));
    }

    /**
     * Check if an account belongs to a user
     */
    private boolean belongsToUser(Account account, User user) {
        return account.getUser() != null &&
                account.getUser().getId().equals(user.getId());
    }

    /**
     * Validate that an account can be updated by checking business rules
     */
    public void validateAccount(Account account) {
        if (account.getName() == null || account.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("Account name cannot be empty");
        }

        if (account.getBalance() == null) {
            throw new IllegalArgumentException("Account balance cannot be null");
        }

        // Add more business rules as needed
    }
}