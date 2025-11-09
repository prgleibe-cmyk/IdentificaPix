import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import * as XLSX from "xlsx";

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
  fileName: string;
  data: any[];
}

interface ContributorFile {
  churchId: string;
  fileName: string;
  data: any[];
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

  // Persistência
  useEffect(() => {
    localStorage.setItem("banks", JSON.stringify(banks));
  }, [banks]);

  useEffect(() => {
    localStorage.setItem("churches", JSON.stringify(churches));
  }, [churches]);

  const addBank = (bank: Bank) => {
    setBanks((prev) => [...prev, bank]);
  };

  const addChurch = (church: Church) => {
    setChurches((prev) => [...prev, church]);
  };

  // 🔹 Função genérica para ler XLSX/XLS e CSV
  const readFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) return reject("Arquivo vazio");
          let workbook;
          if (file.name.endsWith(".csv")) {
            const text = typeof data === "string" ? data : new TextDecoder().decode(data as ArrayBuffer);
            const rows = text.split(/\r?\n/).map((row) => row.split(","));
            resolve(rows);
          } else {
            // XLSX/XLS
            const array = typeof data === "string" ? new Uint8Array([]) : new Uint8Array(data as ArrayBuffer);
            workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
            resolve(json);
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      if (file.name.endsWith(".csv")) reader.readAsText(file);
      else reader.readAsArrayBuffer(file);
    });
  };

  const handleStatementUpload = async (file: File, bankId: string) => {
    try {
      const data = await readFile(file);
      setBankStatementFile({ bankId, fileName: file.name, data });
      setIsCompareDisabled(false);
    } catch (err) {
      console.error("Erro ao ler arquivo:", file.name, err);
      showToast(`Erro ao ler arquivo: ${file.name}`, "error");
    }
  };

  const handleContributorsUpload = async (file: File, churchId: string) => {
    try {
      const data = await readFile(file);
      setContributorFiles((prev) => [...prev, { churchId, fileName: file.name, data }]);
      setIsCompareDisabled(false);
    } catch (err) {
      console.error("Erro ao ler arquivo:", file.name, err);
      showToast(`Erro ao ler arquivo: ${file.name}`, "error");
    }
  };

  // 🔹 Comparação
  const handleCompare = () => {
    if (!bankStatementFile) {
      showToast("Nenhum extrato carregado.", "error");
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      // Preparar dados limpos (remover colunas extras, limpar nomes)
      const cleanedBank = bankStatementFile.data.map((row: any) => ({
        date: row.date || row.Data || "",
        name: (row.name || row.Nome || "").replace(/PIX|DIZIMO/gi, "").trim(),
        value: parseFloat(row.value || row.Valor || 0),
      }));

      const resultsByChurch: Record<string, any[]> = {};
      const unidentified: any[] = [];

      contributorFiles.forEach((churchFile) => {
        const cleanedContributors = churchFile.data.map((row: any) => ({
          date: row.date || row.Data || "",
          name: (row.name || row.Nome || "").replace(/PIX|DIZIMO/gi, "").trim(),
          value: parseFloat(row.value || row.Valor || 0),
        }));
        const matched: any[] = [];
        cleanedContributors.forEach((contributor) => {
          const found = cleanedBank.find((b) => {
            return (
              b.name.toLowerCase() === contributor.name.toLowerCase() &&
              Math.abs(b.value - contributor.value) <= 0.01
            );
          });
          if (found) matched.push({ ...contributor, matched: true });
          else unidentified.push(contributor);
        });
        resultsByChurch[churchFile.churchId] = matched;
      });

      console.log("✅ Comparação concluída");
      console.log("Resultados por igreja:", resultsByChurch);
      console.log("Não identificados:", unidentified);

      setIsLoading(false);
    }, 1000);
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
