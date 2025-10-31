import React, { useContext, useState, useMemo, memo, useEffect } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

// ✅ Import seguro do Supabase
import { supabase } from "../services/supabaseClient";

const RegisterView = memo(() => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('bank');
  const [bankData, setBankData] = useState({ nome_banco: '', codigo_banco: '' });
  const [churchData, setChurchData] = useState({ nome_igreja: '', cnpj_igreja: '' });
  const [loading, setLoading] = useState(false);

  const handleBankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBankData({ ...bankData, [e.target.name]: e.target.value });
  };

  const handleChurchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChurchData({ ...churchData, [e.target.name]: e.target.value });
  };

  const handleBankSubmit = async () => {
    if (!bankData.nome_banco || !bankData.codigo_banco) {
      toast({ title: 'Erro', description: 'Preencha todos os campos do banco.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('bancos').insert([bankData]);
    setLoading(false);

    if (error) {
      toast({ title: 'Erro ao cadastrar banco', description: error.message });
    } else {
      toast({ title: 'Banco cadastrado com sucesso!' });
      setBankData({ nome_banco: '', codigo_banco: '' });
    }
  };

  const handleChurchSubmit = async () => {
    if (!churchData.nome_igreja || !churchData.cnpj_igreja) {
      toast({ title: 'Erro', description: 'Preencha todos os campos da igreja.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('igrejas').insert([churchData]);
    setLoading(false);

    if (error) {
      toast({ title: 'Erro ao cadastrar igreja', description: error.message });
    } else {
      toast({ title: 'Igreja cadastrada com sucesso!' });
      setChurchData({ nome_igreja: '', cnpj_igreja: '' });
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <Tabs defaultValue="bank" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger value="bank">Banco</TabsTrigger>
          <TabsTrigger value="church">Igreja</TabsTrigger>
        </TabsList>

        <TabsContent value="bank">
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome_banco">Nome do Banco</Label>
              <Input
                id="nome_banco"
                name="nome_banco"
                value={bankData.nome_banco}
                onChange={handleBankChange}
              />
            </div>
            <div>
              <Label htmlFor="codigo_banco">Código do Banco</Label>
              <Input
                id="codigo_banco"
                name="codigo_banco"
                value={bankData.codigo_banco}
                onChange={handleBankChange}
              />
            </div>
            <Button onClick={handleBankSubmit} disabled={loading}>
              {loading ? 'Cadastrando...' : 'Cadastrar Banco'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="church">
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome_igreja">Nome da Igreja</Label>
              <Input
                id="nome_igreja"
                name="nome_igreja"
                value={churchData.nome_igreja}
                onChange={handleChurchChange}
              />
            </div>
            <div>
              <Label htmlFor="cnpj_igreja">CNPJ da Igreja</Label>
              <Input
                id="cnpj_igreja"
                name="cnpj_igreja"
                value={churchData.cnpj_igreja}
                onChange={handleChurchChange}
              />
            </div>
            <Button onClick={handleChurchSubmit} disabled={loading}>
              {loading ? 'Cadastrando...' : 'Cadastrar Igreja'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

export default RegisterView;
