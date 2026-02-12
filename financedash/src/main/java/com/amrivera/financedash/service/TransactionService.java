package com.amrivera.financedash.service;

import com.amrivera.financedash.controller.dto.TransactionRequest;
import com.amrivera.financedash.model.Account;
import com.amrivera.financedash.model.Transaction;
import com.amrivera.financedash.model.TransactionType;
import com.amrivera.financedash.repository.AccountRepository;
import com.amrivera.financedash.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;

    public TransactionService(TransactionRepository transactionRepository, AccountRepository accountRepository) {
        this.transactionRepository = transactionRepository;
        this.accountRepository = accountRepository;
    }

    @Transactional
    public Transaction create(TransactionRequest req) {
        Account account = accountRepository.findById(req.getAccountId())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        // Update balance
        BigDecimal delta = req.getAmount();
        if (req.getTxType() == TransactionType.EXPENSE) {
            delta = delta.negate();
        }

        BigDecimal current = account.getBalance() == null ? BigDecimal.ZERO : account.getBalance();
        account.setBalance(current.add(delta));
        accountRepository.save(account);

        // Save transaction
        Transaction t = new Transaction();
        t.setAccountId(req.getAccountId());
        t.setAmount(req.getAmount());
        t.setDescription(req.getDescription());
        t.setCategory(req.getCategory());
        t.setTxDate(req.getTxDate());
        t.setTxType(req.getTxType());

        return transactionRepository.save(t);
    }
}