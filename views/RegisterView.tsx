import React, { useState, useMemo, memo, useEffect } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '../services/supabase';
import { useTranslation } from 'react-i18next';

const RegisterView = memo(() => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('bank');
  const [bankName, setBankName] = useState('');
  const [churchName, setChurchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState<any[]>([]);
  const [churches, setChurches] = useState<any[]>([]);

  // 🔄 Carrega registros existentes
  useEffect(() => {
    const fetchData = async () => {
      const { data: bankData } = await supabase.from('banks').select('*');
      const { data: churchData } = await supabase.from('churches').select('*');
      if (bankData) setBanks(bankData);
      if (churchData) setChurches(churchData);
    };
    fetchData();
  }, []);

  // 🏦 Cadastro de banco
  const handleRegisterBank = async () => {
    if (!bankName.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('banks').insert([{ name: bankName.trim() }]);
    if (!error) {
      setBankName('');
      const { data } = await supabase.from('banks').select('*');
      if (data) setBanks(data);
    }
    setLoading(false);
  };

  // ⛪ Cadastro de igreja
  const handleRegisterChurch = async () => {
    if (!churchName.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('churches').insert([{ name: churchName.trim() }]);
    if (!error) {
      setChurchName('');
      const { data } = await supabase.from('churches').select('*');
      if (data) setChurches(data);
    }
    setLoading(false);
  };

  // 🧠 Memoriza as listas
  const renderedBanks = useMemo(
    () => banks.map((b) => <li key={b.id}>{b.name}</li>),
    [banks]
  );

  const renderedChurches = useMemo(
    () => churches.map((c) => <li key={c.id}>{c.name}</li>),
    [churches]
  );

  return (
    <div className="max-w-lg mx-auto p-6">
      <Tabs defaultValue="bank" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="bank">{t('banks')}</TabsTrigger>
          <TabsTrigger value="church">{t('churches')}</TabsTrigger>
        </TabsList>

        {/* 🏦 Aba de Bancos */}
        <TabsContent value="bank">
          <div className="space-y-3">
            <Label>{t('register_bank')}</Label>
            <Input
              placeholder={t('bank_name_placeholder')}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
            <Button onClick={handleRegisterBank} disabled={loading}>
              {loading ? t('saving') : t('save')}
            </Button>
            <ul className="mt-4 space-y-1">{renderedBanks}</ul>
          </div>
        </TabsContent>

        {/* ⛪ Aba de Igrejas */}
        <TabsContent value="church">
          <div className="space-y-3">
            <Label>{t('register_church')}</Label>
            <Input
              placeholder={t('church_name_placeholder')}
              value={churchName}
              onChange={(e) => setChurchName(e.target.value)}
            />
            <Button onClick={handleRegisterChurch} disabled={loading}>
              {loading ? t('saving') : t('save')}
            </Button>
            <ul className="mt-4 space-y-1">{renderedChurches}</ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

RegisterView.displayName = 'RegisterView';
export default RegisterView;
