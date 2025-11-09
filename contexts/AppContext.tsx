import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

export type ComparisonType = "income" | "expenses" | "both";

interface Bank {
  id: string;
  name: string;
}

interface Church {
  id: string;
  name: string;
  address?: string;
  pastor?: string;
  logoUrl?: string;
}

interface BankStatementFile {
  bankId: string;
  file: File;
}

interface ContributorFile {
  churchId: string;
  file: File;
}

interface AppContextType {
  user: string | null;
  setUser: (user: string | null) => void;
  loading: boolean;
  setLoading: (value: boolean) => void;
  activeView: string;
  setActiveView: (view: string) => void;

  banks: Bank[];
  addBank: (bank: Bank) => void;

  churches: Church[];
  addChurch: (church: Church) => void;

  bankStatementFile: BankStatementFile | null;
  contributorFiles: ContributorFile[];

  handleStatementUpload: (file: File, bankId: string) => void;
  handleContributorsUpload: (file: File, churchId: string) => void;

  isCompareDisabled: boolean;
  isLoading: boolean;
  handleCompare: () => void;
  showToast: (msg: string, type: "success" | "error") => void;

  similarityLevel: number;
  setSimilarityLevel: (value: number) => void;
  dayTolerance: number;
  setDayTolerance: (value: number) => void;
  comparisonType: ComparisonType;
  setComparisonType: (type: ComparisonType) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<string>("dashboard");

  const [banks, setBanks] = useState<Bank[]>(() => {
    const saved = localStorage.getItem("banks");
    return saved ? JSON.parse(saved) : [];
  });

  const [churches, setChurches] = useState<Church[]>(() => {
    const saved = localStorage.getItem("churches");
    return saved ? JSON.parse(saved) : [];
  });

  const [bankStatementFile, setBankStatementFile] = useState<BankStatementFile | null>(null);
  const [contributorFiles, setContributorFiles] = useState<ContributorFile[]>([]);

  const [isCompareDisabled, setIsCompareDisabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [similarityLevel, setSimilarityLevel] = useState<number>(70);
  const [dayTolerance, setDayTolerance] = useState<number>(5);
  const [comparisonType, setComparisonType] = useState<ComparisonType>("both");

  useEffect(() => {
    localStorage.setItem("banks", JSON.stringify(banks));
  }, [banks]);

  useEffect(() => {
    localStorage.setItem("churches", JSON.stringify(churches));
  }, [churches]);

  // 🔹 Funções de cadastro
  const addBank = (bank: Bank) => {
    console.log("💾 Salvando banco:", bank.name);
    setBanks((prev) => [...prev, bank]);
  };

  const addChurch = (church: Church) => {
    console.log("💾 Salvando igreja:", church);
    setChurches((prev) => [...prev, church]);
  };

  // 🔹 Upload de arquivos
  const handleStatementUpload = (file: File, bankId: string) => {
    setBankStatementFile({ bankId, file });
    setIsCompareDisabled(false);
  };

  const handleContributorsUpload = (file: File, churchId: string) => {
    setContributorFiles((prev) => [...prev, { churchId, file }]);
    setIsCompareDisabled(false);
  };

  // 🔹 Função para normalizar nomes (remover acentos, maiúsculas, palavras indesejadas)
  const normalizeName = (name: string) => {
    let normalized = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[^a-zA-Z0-9 ]/g, "") // remove pontuação
      .toUpperCase();
    // remove palavras comuns como PIX, DÍZIMO etc.
    ["PIX", "DIZIMO", "DÍZIMO"].forEach((word) => {
      normalized = normalized.replace(new RegExp(`\\b${word}\\b`, "gi"), "");
    });
    return normalized.trim();
  };

  // 🔹 Função para ler qualquer arquivo Excel ou CSV
  const readFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        if (!data) return reject("Arquivo vazio");

        try {
          if (file.name.endsWith(".csv")) {
            const parsed = Papa.parse(data as string, { header: true });
            resolve(parsed.data);
          } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
            resolve(json);
          } else {
            reject("Formato de arquivo não suportado");
          }
        } catch (err) {
          reject(err);
        }
      };

      if (file.name.endsWith(".csv")) reader.readAsText(file);
      else reader.readAsArrayBuffer(file);
    });
  };

  // 🔹 Identificação das colunas Data, Nome e Valor
  const identifyColumns = (rows: any[]) => {
    const sample = rows[0] || {};
    let dateCol = "", nameCol = "", valueCol = "";

    Object.keys(sample).forEach((key) => {
      const values = rows.map((r) => String(r[key] || ""));
      if (!dateCol && values.some((v) => /\d{2}\/\d{2}\/\d{4}/.test(v))) dateCol = key;
      else if (!valueCol && values.some((v) => /^[\d.,]+$/.test(v))) valueCol = key;
      else if (!nameCol) nameCol = key;
    });

    return { dateCol, nameCol, valueCol };
  };

  // 🔹 Comparação principal
  const handleCompare = async () => {
    if (!bankStatementFile || contributorFiles.length === 0) {
      showToast("É necessário carregar os arquivos do banco e das igrejas", "error");
      return;
    }

    setIsLoading(true);
    try {
      // 1️⃣ Ler banco
      const bankData = await readFile(bankStatementFile.file);
      const { dateCol: bankDateCol, nameCol: bankNameCol, valueCol: bankValueCol } = identifyColumns(bankData);

      // Normalizar banco
      const normalizedBankData = bankData.map((row) => ({
        date: row[bankDateCol],
        name: normalizeName(row[bankNameCol]),
        value: parseFloat(String(row[bankValueCol]).replace(",", ".")) || 0,
      }));

      const resultsByChurch: Record<string, any[]> = {};
      let unidentified: any[] = [];

      // 2️⃣ Ler cada igreja
      for (const contrib of contributorFiles) {
        const data = await readFile(contrib.file);
        const { dateCol, nameCol, valueCol } = identifyColumns(data);

        const normalizedData = data.map((row) => ({
          date: row[dateCol],
          name: normalizeName(row[nameCol]),
          value: parseFloat(String(row[valueCol]).replace(",", ".")) || 0,
        }));

        // Comparação simples: encontrar transações correspondentes por nome e valor
        const matched: any[] = [];
        normalizedData.forEach((cRow) => {
          const matchIndex = normalizedBankData.findIndex(
            (bRow) =>
              bRow.name === cRow.name &&
              Math.abs(bRow.value - cRow.value) < 0.01 // tolerância
          );
          if (matchIndex >= 0) {
            matched.push(cRow);
            normalizedBankData.splice(matchIndex, 1); // remover banco usado
          } else {
            unidentified.push({ ...cRow, churchId: contrib.churchId });
          }
        });

        resultsByChurch[contrib.churchId] = matched;
      }

      console.log("✅ Comparação concluída");
      console.log("Resultados por igreja:", resultsByChurch);
      console.log("Não identificados:", unidentified);

      // Aqui você pode gerar download de CSV ou PDF se desejar

    } catch (err) {
      console.error("Erro durante a comparação:", err);
      showToast("Erro ao processar os arquivos. Verifique os formatos.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string, type: "success" | "error") => {
    alert(`${type.toUpperCase()}: ${msg}`);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        loading,
        setLoading,
        activeView,
        setActiveView,
        banks,
        addBank,
        churches,
        addChurch,
        bankStatementFile,
        contributorFiles,
        handleStatementUpload,
        handleContributorsUpload,
        isCompareDisabled,
        isLoading,
        handleCompare,
        showToast,
        similarityLevel,
        setSimilarityLevel,
        dayTolerance,
        setDayTolerance,
        comparisonType,
        setComparisonType,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext deve ser usado dentro de um AppProvider");
  return context;
};

console.log("✅ AppContext.tsx carregado com sucesso!");
export { AppContext };
