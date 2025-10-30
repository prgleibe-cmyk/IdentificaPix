import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { FileUploader } from '../components/FileUploader';
import { SearchIcon, ArrowsRightLeftIcon } from '../components/Icons';
import { ComparisonSettingsForm } from '../components/shared/ComparisonSettingsForm';

export const UploadView: React.FC = () => {
  const { 
    banks, 
    churches, 
    bankStatementFile, 
    contributorFiles, 
    handleStatementUpload, 
    handleContributorsUpload,
    removeBankStatementFile,
    removeContributorFile,
    isCompareDisabled,
  } = useContext(AppContext);

  const { t } = useTranslation();
  const [bankSearch, setBankSearch] = useState('');
  const [churchSearch, setChurchSearch] = useState('');

  const filteredBanks = useMemo(
    () => banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase())),
    [banks, bankSearch]
  );
  const filteredChurches = useMemo(
    () => churches.filter(c => c.name.toLowerCase().includes(churchSearch.toLowerCase())),
    [churches, churchSearch]
  );

  return (
    <>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{t('upload.title')}</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-6">{t('upload.subtitle')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Bank Statement Upload Section */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200">1. {t('upload.statementTitle')}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('upload.statementSubtitle')}</p>

          <div className="relative mb-2">
            <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('register.searchBank')}
              value={bankSearch}
              onChange={e => setBankSearch(e.target.value)}
              className="pl-10 p-2 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {filteredBanks.map(bank => (
              <div key={bank.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-4">{bank.name}</span>
                <FileUploader
                  id={`bank-uploader-${bank.id}`}
                  title={t('upload.upload')}
                  onFileUpload={(content, name) => handleStatementUpload(content, name, bank.id)}
                  isUploaded={bankStatementFile?.bankId === bank.id && !!bankStatementFile.content}
                  uploadedFileName={bankStatementFile?.bankId === bank.id ? bankStatementFile.fileName : null}
                  disabled={!!bankStatementFile && bankStatementFile.bankId !== bank.id}
                  onDelete={bankStatementFile?.bankId === bank.id ? removeBankStatementFile : undefined}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Contributor Lists Upload Section */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200">2. {t('upload.contributorsTitle')}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('upload.contributorsSubtitle')}</p>

          <div className="relative mb-2">
            <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('register.searchChurch')}
              value={churchSearch}
              onChange={e => setChurchSearch(e.target.value)}
              className="pl-10 p-2 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {filteredChurches.map(church => {
              const uploadedFile = contributorFiles.find(f => f.churchId === church.id);
              return (
                <div key={church.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                  <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-4">{church.name}</span>
                  <FileUploader
                    id={`church-uploader-${church.id}`}
                    title={t('upload.upload')}
                    onFileUpload={(content, name) => handleContributorsUpload(content, name, church.id)}
                    isUploaded={!!uploadedFile}
                    uploadedFileName={uploadedFile?.fileName ?? null}
                    onDelete={uploadedFile ? () => removeContributorFile(church.id) : undefined}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {!isCompareDisabled && (
        <div className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-3 mb-6">
            <ArrowsRightLeftIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">3. {t('settings.comparisonTitle')}</h3>
          </div>
          <ComparisonSettingsForm />
        </div>
      )}
    </>
  );
};
