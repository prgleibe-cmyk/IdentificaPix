import { Contributor, Transaction } from "../types";

export const getAISuggestion = async (
  transaction: Transaction,
  contributors: Contributor[]
): Promise<string> => {
  const contributorNames = contributors.map((c) => c.name).join(", ");

  try {
    const response = await fetch("/api/genai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionDescription: transaction.description,
        contributorNames,
      }),
    });

    const data = await response.json();
    return data.text || "Nenhuma sugestão clara";
  } catch (error) {
    console.error("Erro ao chamar endpoint de IA", error);
    return "Erro ao contatar a IA.";
  }
};
