import React, { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { ComparisonSettingsForm } from '../components/shared/ComparisonSettingsForm'; // <-- caminho corrigido
import { ArrowsUpTrayIcon } from '@heroicons/react/24/solid';

export const UploadView: React.FC = () => {
  const {
    banks,
    churches,
    addBank,
    addChurch,
    handleStatementUpload,
    handleContributorsUpload,
    handleCompare,
    isCompareDisabled,
    isLoading,
    bankStatementFile,
    contributorFiles,
    showToast,
  } = useContext(AppContext);

  const handleAddBank = () => {
    const name = prompt('Digite o nome do banco:');
    if (name && name.trim()) {
      addBank({ id: crypto.randomUUID(), name: name.trim() });
      showToast('Banco cadastrado com sucesso!', 'success');
    }
  };

  const handleAddChurch = () => {
    const name = prompt('Digite o nome da igreja:');
    if (name && name.trim()) {
      addChurch({ id: crypto.randomUUID(), name: name.trim() });
      showToast('Igreja cadastrada com sucesso!', 'success');
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'bank' | 'church',
    id: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (type === 'bank') handleStatementUpload(content, file.name, id);
      else handleContributorsUpload(content, file.name, id);
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 space-y-10 max-w-5xl mx-auto">
      {/* === Bancos === */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Bancos cadastrados
          </h2>
          <button
            onClick={handleAddBank}
            className="px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 transition"
          >
            + Adicionar Banco
          </button>
        </div>
        {banks.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum banco cadastrado.</p>
        ) : (
          <ul className="space-y-3">
            {banks.map((bank) => (
              <li
                key={bank.id}
                className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700 rounded-lg"
              >
                <span className="text-slate-800 dark:text-slate-200">
                  {bank.name}
                </span>
                <label
                  htmlFor={`bank-${bank.id}`}
                  className="flex items-center gap-2 cursor-pointer text-blue-700 dark:text-blue-400 hover:underline"
                >
                  <ArrowsUpTrayIcon className="w-5 h-5" />
                  {bankStatementFile?.bankId === bank.id
                    ? bankStatementFile.fileName
                    : 'Carregar extrato'}
                </label>
                <input
                  id={`bank-${bank.id}`}
                  type="file"
                  accept=".csv,.xls,.xlsx,.pdf"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'bank', bank.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* === Igrejas === */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Igrejas cadastradas
          </h2>
          <button
            onClick={handleAddChurch}
            className="px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 transition"
          >
            + Adicionar Igreja
          </button>
        </div>
        {churches.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhuma igreja cadastrada.</p>
        ) : (
          <ul className="space-y-3">
            {churches.map((church) => (
              <li
                key={church.id}
                className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700 rounded-lg"
              >
                <span className="text-slate-800 dark:text-slate-200">
                  {church.name}
                </span>
                <label
                  htmlFor={`church-${church.id}`}
                  className="flex items-center gap-2 cursor-pointer text-blue-700 dark:text-blue-400 hover:underline"
                >
                  <ArrowsUpTrayIcon className="w-5 h-5" />
                  {contributorFiles.find((f) => f.churchId === church.id)?.fileName ||
                    'Carregar arquivo'}
                </label>
                <input
                  id={`church-${church.id}`}
                  type="file"
                  accept=".csv,.xls,.xlsx,.pdf"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'church', church.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* === Configurações de Comparação === */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md">
        <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">
          Configurações da Comparação
        </h2>
        <ComparisonSettingsForm />
      </div>

      {/* === Botão Iniciar Comparação === */}
      <div className="flex justify-center">
        <button
          onClick={handleCompare}
          disabled={isCompareDisabled || isLoading}
          className={`px-8 py-3 rounded-md font-semibold text-white transition ${
            isCompareDisabled || isLoading
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-blue-700 hover:bg-blue-800'
          }`}
        >
          {isLoading ? 'Comparando...' : 'Iniciar Comparação'}
        </button>
      </div>
    </div>
  );
};

export default UploadView;
