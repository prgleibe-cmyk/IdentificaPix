import React from "react";
import { useAppContext } from "../contexts/AppContext";

export const ReportsView: React.FC = () => {
  const { comparisonResults, churches, isLoading } = useAppContext();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-lg font-semibold text-gray-600 dark:text-gray-200">
          Gerando relatório...
        </p>
      </div>
    );
  }

  if (!comparisonResults) {
    return (
      <div className="p-6 text-center text-gray-700 dark:text-gray-300">
        Nenhum resultado de comparação disponível.<br />
        <span className="text-sm opacity-75">
          Faça uma comparação na aba “Iniciar Comparação” para gerar relatórios.
        </span>
      </div>
    );
  }

  const { resultsByChurch, unidentified } = comparisonResults;

  console.log("📊 Estrutura dos resultados:", resultsByChurch);
  const firstChurchId = Object.keys(resultsByChurch)[0];
  if (firstChurchId) {
    console.log("📊 Estrutura de uma igreja:", resultsByChurch[firstChurchId]);
  }

  // Função para capturar valores mesmo com nomes de colunas diferentes
  const getValue = (obj: any, keys: string[]) => {
    for (const k of keys) {
      const foundKey = Object.keys(obj).find(
        (key) => key.toLowerCase().includes(k.toLowerCase())
      );
      if (foundKey) return obj[foundKey];
    }
    return "";
  };

  // Formata valores numéricos como moeda
  const formatCurrency = (value: any) => {
    const num = parseFloat(value);
    if (isNaN(num)) return value || "";
    return num.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  // Formata datas no padrão brasileiro
  const formatDate = (value: any) => {
    if (!value) return "";
    if (typeof value === "string" && value.includes("/")) return value;
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return value;
      return d.toLocaleDateString("pt-BR");
    } catch {
      return value;
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">
        Relatórios de Comparação
      </h1>

      {Object.keys(resultsByChurch).length === 0 ? (
        <p className="text-gray-500">Nenhum resultado encontrado.</p>
      ) : (
        Object.entries(resultsByChurch).map(([churchId, results]) => {
          const church = churches.find((c) => c.id === churchId);
          return (
            <div
              key={churchId}
              className="mb-8 border border-slate-200 dark:border-slate-700 rounded-xl p-5"
            >
              <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-3">
                {church?.name || "Igreja Desconhecida"}
              </h2>
              {results.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse border border-slate-300 dark:border-slate-700">
                    <thead className="bg-slate-100 dark:bg-slate-700">
                      <tr>
                        <th className="border px-3 py-2 text-left">Data</th>
                        <th className="border px-3 py-2 text-left">Nome</th>
                        <th className="border px-3 py-2 text-left">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r: any, idx: number) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50 dark:hover:bg-slate-600"
                        >
                          <td className="border px-3 py-2">
                            {formatDate(getValue(r, ["date", "data"]))}
                          </td>
                          <td className="border px-3 py-2">
                            {getValue(r, [
                              "name",
                              "nome",
                              "beneficiário",
                              "contribuinte",
                            ])}
                          </td>
                          <td className="border px-3 py-2">
                            {formatCurrency(getValue(r, ["value", "valor", "quantia"]))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">Nenhum registro correspondente.</p>
              )}
            </div>
          );
        })
      )}

      {unidentified && unidentified.length > 0 && (
        <div className="mt-10 border-t pt-6">
          <h2 className="text-xl font-semibold text-red-700 dark:text-red-300 mb-3">
            Transações Não Identificadas ({unidentified.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-slate-300 dark:border-slate-700">
              <thead className="bg-red-50 dark:bg-slate-700">
                <tr>
                  <th className="border px-3 py-2 text-left">Data</th>
                  <th className="border px-3 py-2 text-left">Nome</th>
                  <th className="border px-3 py-2 text-left">Valor</th>
                </tr>
              </thead>
              <tbody>
                {unidentified.map((u: any, idx: number) => (
                  <tr
                    key={idx}
                    className="hover:bg-red-50 dark:hover:bg-slate-600"
                  >
                    <td className="border px-3 py-2">
                      {formatDate(getValue(u, ["date", "data"]))}
                    </td>
                    <td className="border px-3 py-2">
                      {getValue(u, [
                        "name",
                        "nome",
                        "beneficiário",
                        "contribuinte",
                      ])}
                    </td>
                    <td className="border px-3 py-2">
                      {formatCurrency(getValue(u, ["value", "valor", "quantia"]))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
