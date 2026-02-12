package com.amrivera.financedash.controller.dto;

import com.amrivera.financedash.model.TransactionType;

import java.math.BigDecimal;
import java.time.LocalDate;

public class TransactionResponse {
    public Long id;
    public Long accountId;
    public BigDecimal amount;
    public String description;
    public String category;
    public LocalDate txDate;
    public TransactionType txType;
}