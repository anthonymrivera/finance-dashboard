package com.amrivera.financedash.repository;

import com.amrivera.financedash.model.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findByAccountIdOrderByTxDateDesc(Long accountId);
    boolean existsByAccountId(Long accountId);
    long countByAccountId(Long accountId);
}