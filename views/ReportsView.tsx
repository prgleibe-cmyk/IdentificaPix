import React from "react";
import { useAppContext } from "../contexts/AppContext";

const ReportsView: React.FC = () => {
  const { comparisonResults, churches, isLoading } = useAppContext();

  if (isLoading)
    return (
      <div className="text-center text-gray-600 p-6">
        ⏳ Gerando relatório...
      </div>
    );

  if (!comparisonResults || !comparisonResults.resultsByChurch) {
    return (
      <div className="text-center text-gray-500 p-6">
        Nenhum relatório disponível. Faça uma comparação para ver os resultados.
      </div>
    );
  }

  const { resultsByChurch, unidentified } = comparisonResults;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        📊 Relatório de Comparação
      </h1>

      {/* 🔹 Resultados por igreja */}
      {Object.keys(resultsByChurch).length === 0 && (
        <div className="text-gray-500 italic mb-4">
          Nenhum resultado encontrado.
        </div>
      )}

      {Object.entries(resultsByChurch).map(([churchId, results]) => {
        const church = churches?.find((c) => c.id === churchId);

        return (
          <div
            key={churchId}
            className="mb-10 bg-white shadow-md rounded-lg p-4"
          >
            <h2 className="text-xl font-semibold text-blue-600 mb-4">
              {church ? church.name : "Igreja não identificada"}
            </h2>

            {Array.isArray(results) && results.length > 0 ? (
              <table className="w-full border border-gray-300 rounded-lg overflow-hidden text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2 text-left">Data</th>
                    <th className="border px-3 py-2 text-left">Nome</th>
                    <th className="border px-3 py-2 text-left">Valor</th>
                    <th className="border px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border px-3 py-2">{r?.date || "-"}</td>
                      <td className="border px-3 py-2">{r?.name || "-"}</td>
                      <td className="border px-3 py-2">
                        {r?.value ? r.value.toFixed(2) : "0.00"}
                      </td>
                      <td
                        className={`border px-3 py-2 font-medium ${
                          r?.matched ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {r?.matched ? "Identificado" : "Não identificado"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-gray-500 italic">
                Nenhum registro encontrado para esta igreja.
              </div>
            )}
          </div>
        );
      })}

      {/* 🔹 Contribuições não identificadas */}
      <div className="bg-white shadow-md rounded-lg p-4">
        <h2 className="text-xl font-semibold text-red-600 mb-4">
          Contribuições não identificadas
        </h2>

        {Array.isArray(unidentified) && unidentified.length > 0 ? (
          <table className="w-full border border-gray-300 rounded-lg overflow-hidden text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">Data</th>
                <th className="border px-3 py-2 text-left">Nome</th>
                <th className="border px-3 py-2 text-left">Valor</th>
              </tr>
            </thead>
            <tbody>
              {unidentified.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">{r?.date || "-"}</td>
                  <td className="border px-3 py-2">{r?.name || "-"}</td>
                  <td className="border px-3 py-2">
                    {r?.value ? r.value.toFixed(2) : "0.00"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-gray-500 italic">
            Nenhuma contribuição não identificada.
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsView;
