import { Contributor, Transaction } from "../types";

// -------------------------------
// Serviço de chamada à IA otimizado
// -------------------------------

export const getAISuggestion = async (
  transaction: Transaction,
  contributors: Contributor[]
): Promise<string> => {
  if (!transaction?.description || !contributors?.length) {
    // Proteção contra chamadas desnecessárias
    return "Nenhuma sugestão clara";
  }

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

    if (!response.ok) {
      console.warn("Resposta da IA não OK", response.status, response.statusText);
      return "Erro ao contatar a IA.";
    }

    const data = await response.json();
    return data?.text?.trim() || "Nenhuma sugestão clara";
  } catch (error) {
    console.error("Erro ao chamar endpoint de IA", error);
    return "Erro ao contatar a IA.";
  }
};
