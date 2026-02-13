import api from "./axiosConfig";

export const getTransactions = async (accountId) => {
  const res = await api.get("/api/transactions", { params: { accountId } });
  return res.data;
};

export const createTransaction = async (payload) => {
  const res = await api.post("/api/transactions", payload);
  return res.data;
};
