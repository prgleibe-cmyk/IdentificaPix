import { Contributor, Transaction } from '../types';

export const getAISuggestion = async (
  transaction: Transaction,
  contributors: Contributor[]
): Promise<string> => {
  try {
    const response = await fetch('/.netlify/functions/getAISuggestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionDescription: transaction.description,
        contributors
      }),
    });

    const data = await response.json();
    return data.suggestion;

  } catch (error) {
    console.error("Erro ao chamar a função serverless:", error);
    return "Erro ao contatar a IA.";
  }
};
