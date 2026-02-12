import api from "./axiosConfig";

export const getTransactions = async (accountId) => {
  const res = await api.get("/transactions", { params: { accountId } });
  return res.data;
};

export const createTransaction = async (payload) => {
  const res = await api.post("/transactions", payload);
  return res.data;
};
