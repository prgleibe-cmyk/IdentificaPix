import React, { useState, useRef, useEffect, useContext } from 'react';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { UsersIcon, PlusCircleIcon, SearchIcon, XMarkIcon } from '../Icons';
import { Camera, Trash2, Edit2, Loader2, Upload, Check, AlertTriangle, FileUp, Sparkles, User, Building2, Landmark, MapPin, Phone, Mail, FileText, Tag, Calendar, ShieldCheck, Globe } from 'lucide-react';
import * as XLSX from 'xlsx';
import { InlineRoleSelector } from './InlineRoleSelector';

const formatCpfCnpj = (value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length === 11) {
        return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (clean.length === 14) {
        return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return value;
};

export const ContributorsList: React.FC = () => {
    const { showToast } = useUI();
    const { churches } = useContext(AppContext);
    const { subscription, user } = useAuth();
    
    // Principal User check: owner, admin, principal or ownerId matching user.id
    const isPrincipalUser = !subscription?.role || subscription?.role === 'owner' || subscription?.role === 'admin' || subscription?.role === 'principal' || subscription?.ownerId === user?.id;
    
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [contributors, setContributors] = useState<any[]>([]);
    const [isLoadingContributors, setIsLoadingContributors] = useState<boolean>(true);
    const [editingContributor, setEditingContributor] = useState<any | null>(null);
    
    // Form States (Pessoa Física & Empresa / Fornecedor)
    const [personType, setPersonType] = useState<'PF' | 'PJ'>('PF');
    const [fullName, setFullName] = useState('');
    const [tradeName, setTradeName] = useState('');
    const [selectedChurchId, setSelectedChurchId] = useState('church-1');
    const [isGlobal, setIsGlobal] = useState<boolean>(false);
    const [cpf, setCpf] = useState('');
    const [rgIe, setRgIe] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [category, setCategory] = useState('');
    
    // Vínculo / Cargo States
    const DEFAULT_ROLES_LIST = [
        'Membro',
        'Visitante',
        'Pastor / Pastora',
        'Diácono / Diaconisa',
        'Presbítero / Evangelista',
        'Obreiro / Obreira',
        'Líder de Ministério / Célula',
        'Voluntário',
        'Dizimista',
        'Músico / Louvor',
        'Prestador de Serviços',
        'Fornecedor / Empresa',
        'Concessionária / Utilidades',
        'Outro'
    ];

    const DEFAULT_SUPPLIER_CATEGORIES = [
        'Construção e Reformas',
        'Equipamentos de Som / Iluminação',
        'Prestação de Serviços Técnicos',
        'Água, Energia, Internet e Concessionárias',
        'Alimentação, Eventos e Buffet',
        'Gráfica, Comunicação Visual e Papelaria',
        'Outros Fornecedores'
    ];

    const [rolePosition, setRolePosition] = useState<string>('Membro');
    const [customRoles, setCustomRoles] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('iggestor_custom_roles_v1');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.error('Error loading custom roles', e);
        }
        return DEFAULT_ROLES_LIST;
    });

    const [supplierCategories, setSupplierCategories] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('iggestor_supplier_categories_v1');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.error('Error loading supplier categories', e);
        }
        return DEFAULT_SUPPLIER_CATEGORIES;
    });

    const saveCustomRoles = (updated: string[]) => {
        setCustomRoles(updated);
        try {
            localStorage.setItem('iggestor_custom_roles_v1', JSON.stringify(updated));
        } catch (e) {
            console.error('Error saving custom roles', e);
        }
    };

    const handleAddRole = (newRole: string) => {
        const trimmed = newRole.trim();
        if (!trimmed) return;
        if (!customRoles.includes(trimmed)) {
            const updated = [...customRoles, trimmed];
            saveCustomRoles(updated);
        }
        setRolePosition(trimmed);
        setCategory(trimmed);
    };

    const handleRenameRole = (oldRole: string, newRole: string) => {
        const trimmed = newRole.trim();
        if (!trimmed) return;
        const updated = customRoles.map(r => r === oldRole ? trimmed : r);
        saveCustomRoles(updated);
        if (rolePosition === oldRole) {
            setRolePosition(trimmed);
            setCategory(trimmed);
        }
    };

    const handleDeleteRole = (roleToDelete: string) => {
        const updated = customRoles.filter(r => r !== roleToDelete);
        saveCustomRoles(updated);
        if (rolePosition === roleToDelete) {
            setRolePosition('');
            setCategory('');
        }
    };

    const saveSupplierCategories = (updated: string[]) => {
        setSupplierCategories(updated);
        try {
            localStorage.setItem('iggestor_supplier_categories_v1', JSON.stringify(updated));
        } catch (e) {
            console.error('Error saving supplier categories', e);
        }
    };

    const handleAddSupplierCategory = (newCat: string) => {
        const trimmed = newCat.trim();
        if (!trimmed) return;
        if (!supplierCategories.includes(trimmed)) {
            const updated = [...supplierCategories, trimmed];
            saveSupplierCategories(updated);
        }
        setCategory(trimmed);
    };

    const handleRenameSupplierCategory = (oldCat: string, newCat: string) => {
        const trimmed = newCat.trim();
        if (!trimmed) return;
        const updated = supplierCategories.map(c => c === oldCat ? trimmed : c);
        saveSupplierCategories(updated);
        if (category === oldCat) {
            setCategory(trimmed);
        }
    };

    const handleDeleteSupplierCategory = (catToDelete: string) => {
        const updated = supplierCategories.filter(c => c !== catToDelete);
        saveSupplierCategories(updated);
        if (category === catToDelete) {
            setCategory('');
        }
    };

    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankAgency, setBankAgency] = useState('');
    const [bankAccount, setBankAccount] = useState('');
    const [addressCep, setAddressCep] = useState('');
    const [addressStreet, setAddressStreet] = useState('');
    const [addressNumber, setAddressNumber] = useState('');
    const [addressCity, setAddressCity] = useState('');
    const [addressState, setAddressState] = useState('');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
    const [attemptedSubmit, setAttemptedSubmit] = useState(false);

    // Photo States (Client-side visual only, prepared for POST /api/v1/contributors/:id/photo)
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Batch Import States
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isLoadingImport, setIsLoadingImport] = useState(false);
    const [parsedContributors, setParsedContributors] = useState<any[]>([]);
    const [defaultImportChurchId, setDefaultImportChurchId] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const importFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (churches && churches.length > 0 && !defaultImportChurchId) {
            setDefaultImportChurchId(churches[0].id);
        }
    }, [churches, defaultImportChurchId]);

    const isValidCpf = (cpfStr: string): boolean => {
        const clean = cpfStr.replace(/\D/g, '');
        if (clean.length !== 11) return false;
        if (/^(\d)\1+$/.test(clean)) return false;
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i);
        let rev = 11 - (sum % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(clean.charAt(9))) return false;
        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i);
        rev = 11 - (sum % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(clean.charAt(10))) return false;
        return true;
    };

    const extractNameFromText = (text: string, cpfStr: string): string => {
        let cleanText = text.replace(cpfStr, '');
        const noiseRegex = /\b(?:PIX|RECEBIDO|ENVIADO|PARA|DE|CPF|CNPJ|TED|DOC|CONTA|VALOR|AGENCIA|PAGAMENTO|PAGTO|TRANSF|TRANSFERENCIA|SICOOB|BRADESCO|ITAU|SANTANDER|CAIXA|BB|BANCO|CHAVE|NOME|TAR|TARIFA|SALDO|ESTORNO|LANÇAMENTO|DEBITO|CREDITO|AUTORIZADO|REMETENTE|DESTINATARIO|FAVORECIDO|PAGO|PGTO|REALIZADO|COMPE|COBRANÇA|BOLETO|CHAVE\s+PIX|AUTORIZADA)\b/gi;
        cleanText = cleanText.replace(noiseRegex, ' ');
        cleanText = cleanText.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, ' ');
        cleanText = cleanText.replace(/\s+/g, ' ').trim();

        const words = cleanText.split(' ');
        const nameWords: string[] = [];
        const prepositions = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const wordLower = word.toLowerCase();
            if (prepositions.has(wordLower)) {
                if (nameWords.length > 0) {
                    nameWords.push(wordLower);
                }
            } else if (word.length >= 3) {
                nameWords.push(word);
            }
        }

        while (nameWords.length > 0 && prepositions.has(nameWords[nameWords.length - 1].toLowerCase())) {
            nameWords.pop();
        }

        if (nameWords.length >= 2) {
            return nameWords.slice(0, 4).join(' ').toUpperCase();
        }
        return '';
    };

    const parseOfx = (text: string): { name: string; cpf: string }[] => {
        const results: { name: string; cpf: string }[] = [];
        const stmttrnBlocks = text.split(/<\/STMTTRN>|<STMTTRN>/gi);
        const cpfRegex = /\b(?:\d{3}\.?\d{3}\.?\d{3}-?\d{2})|(?:\d{11})|(?:\*{3}\.?\d{3}\.?\d{3}-?(?:\*{2}|\d{2}))|(?:\*{3}\.?\d{3}\.?\d{3}-?\d{2})\b/g;
        const seenCpfs = new Set<string>();

        for (const block of stmttrnBlocks) {
            const memoMatch = block.match(/<MEMO>([^<\r\n]+)/i);
            const nameMatch = block.match(/<NAME>([^<\r\n]+)/i);
            const memoText = memoMatch ? memoMatch[1].trim() : '';
            const nameText = nameMatch ? nameMatch[1].trim() : '';
            const combinedText = `${nameText} ${memoText}`.trim();
            
            if (!combinedText) continue;

            const cpfs = combinedText.match(cpfRegex);
            if (cpfs && cpfs.length > 0) {
                for (const rawCpf of cpfs) {
                    const cleanCpf = rawCpf.replace(/\D/g, '');
                    if (cleanCpf.length === 11 && !rawCpf.includes('*')) {
                        if (!isValidCpf(cleanCpf)) continue;
                    }

                    const cpfKey = cleanCpf || rawCpf;
                    if (seenCpfs.has(cpfKey)) continue;
                    seenCpfs.add(cpfKey);

                    const extractedName = extractNameFromText(combinedText, rawCpf);
                    if (extractedName && extractedName.length > 3) {
                        results.push({
                            name: extractedName,
                            cpf: rawCpf
                        });
                    }
                }
            }
        }
        return results;
    };

    const parseTextLines = (text: string): { name: string; cpf: string }[] => {
        const results: { name: string; cpf: string }[] = [];
        const lines = text.split(/\r?\n/);
        const cpfRegex = /\b(?:\d{3}\.?\d{3}\.?\d{3}-?\d{2})|(?:\d{11})|(?:\*{3}\.?\d{3}\.?\d{3}-?(?:\*{2}|\d{2}))|(?:\*{3}\.?\d{3}\.?\d{3}-?\d{2})\b/g;
        const seenCpfs = new Set<string>();

        for (const line of lines) {
            if (!line.trim()) continue;
            const cpfs = line.match(cpfRegex);
            if (cpfs && cpfs.length > 0) {
                for (const rawCpf of cpfs) {
                    const cleanCpf = rawCpf.replace(/\D/g, '');
                    if (cleanCpf.length === 11 && !rawCpf.includes('*')) {
                        if (!isValidCpf(cleanCpf)) continue;
                    }

                    const cpfKey = cleanCpf || rawCpf;
                    if (seenCpfs.has(cpfKey)) continue;
                    seenCpfs.add(cpfKey);

                    const extractedName = extractNameFromText(line, rawCpf);
                    if (extractedName && extractedName.length > 3) {
                        results.push({
                            name: extractedName,
                            cpf: rawCpf
                        });
                    }
                }
            }
        }
        return results;
    };

    const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportFile(file);
        setIsLoadingImport(true);

        try {
            const fileNameLower = file.name.toLowerCase();
            let rawText = '';
            let detected: { name: string; cpf: string }[] = [];

            if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
                workbook.SheetNames.forEach((sheetName) => {
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                    json.forEach((row) => {
                        rawText += row.join(' ') + '\n';
                    });
                });
                detected = parseTextLines(rawText);
            } else {
                rawText = await file.text();
                if (fileNameLower.endsWith('.ofx')) {
                    detected = parseOfx(rawText);
                } else {
                    detected = parseTextLines(rawText);
                }
            }

            if (detected.length === 0) {
                showToast("Nenhum contribuinte com Nome e CPF identificável no arquivo.", "error");
                setImportFile(null);
            } else {
                const list = detected.map((item, idx) => ({
                    id: `temp-${idx}`,
                    name: item.name,
                    cpf: item.cpf,
                    phone: '',
                    email: '',
                    status: 'Ativo'
                }));
                setParsedContributors(list);
            }
        } catch (error) {
            console.error("Erro ao ler arquivo:", error);
            showToast("Falha ao ler ou analisar o arquivo.", "error");
            setImportFile(null);
        } finally {
            setIsLoadingImport(false);
        }
    };

    const checkDuplicate = (parsedCpf: string, parsedName: string, churchId: string) => {
        const cleanParsedCpf = parsedCpf.replace(/\D/g, '');
        const cleanParsedName = parsedName.trim().replace(/\s+/g, ' ').toUpperCase();

        return contributors.some(c => {
            const isSameChurch = c.church_id === churchId;
            if (!isSameChurch) return false;

            if (cleanParsedCpf && c.cpf) {
                const cleanExistingCpf = c.cpf.replace(/\D/g, '');
                if (cleanExistingCpf === cleanParsedCpf) return true;
            }

            if (c.canonical_name === cleanParsedName) return true;

            return false;
        });
    };

    const handleExecuteImport = async () => {
        if (!defaultImportChurchId || defaultImportChurchId === 'church-1') {
            showToast("Selecione uma igreja de destino válida.", "error");
            return;
        }

        const toImport = parsedContributors.filter(c => !checkDuplicate(c.cpf, c.name, defaultImportChurchId));
        if (toImport.length === 0) {
            showToast("Todos os contribuintes detectados já estão cadastrados nesta igreja.", "error");
            return;
        }

        setIsImporting(true);
        setImportProgress({ current: 0, total: toImport.length });

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < toImport.length; i++) {
            const item = toImport[i];
            setImportProgress({ current: i + 1, total: toImport.length });

            try {
                const canonical_name = item.name.trim().replace(/\s+/g, ' ').toUpperCase();
                const rawCpf = item.cpf.replace(/\D/g, '');
                const sanitizedCpf = rawCpf.length > 0 ? rawCpf : null;

                const payload = {
                    church_id: defaultImportChurchId,
                    canonical_name,
                    cpf: sanitizedCpf,
                    email: null,
                    phone: null,
                    status: 'active'
                };

                const response = await fetch('/api/v1/contributors', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (response.status === 201 || response.status === 200) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (err) {
                errorCount++;
            }
        }

        setIsImporting(false);
        showToast(`${successCount} novos contribuintes cadastrados com sucesso.${errorCount > 0 ? ` ${errorCount} falhas.` : ''}`, "success");
        
        setIsImportModalOpen(false);
        setImportFile(null);
        setParsedContributors([]);
        fetchContributors();
    };

    // Real list of churches from context
    const tempChurches = [
        { id: 'church-1', name: 'Selecione uma igreja' },
        ...churches.map((c: any) => ({ id: c.id, name: c.name }))
    ];

    const fetchContributors = async () => {
        try {
            setIsLoadingContributors(true);
            const response = await fetch('/api/v1/contributors');
            if (response.ok) {
                const data = await response.json();
                setContributors(data);
            } else {
                console.error('[ContributorsList] Failed to fetch contributors');
            }
        } catch (error) {
            console.error('[ContributorsList] Error fetching contributors:', error);
        } finally {
            setIsLoadingContributors(false);
        }
    };

    useEffect(() => {
        fetchContributors();
    }, []);

    const handleNewContributorClick = () => {
        setIsModalOpen(true);
    };

    const handleEditClick = (contributor: any) => {
        setEditingContributor(contributor);
        setPersonType(contributor.person_type === 'PJ' || (contributor.cpf && contributor.cpf.replace(/\D/g, '').length === 14) ? 'PJ' : 'PF');
        setFullName(contributor.canonical_name || '');
        setTradeName(contributor.trade_name || '');
        setSelectedChurchId(contributor.church_id || 'church-1');
        setIsGlobal(Boolean(contributor.is_global));
        setCpf(contributor.cpf || '');
        setRgIe(contributor.rg_ie || '');
        setBirthDate(contributor.birth_date || '');
        setContactPerson(contributor.contact_person || '');

        const savedCat = contributor.category || '';
        setCategory(savedCat);
        if (savedCat && !supplierCategories.includes(savedCat)) {
            const nextCats = [...supplierCategories, savedCat];
            setSupplierCategories(nextCats);
            try {
                localStorage.setItem('iggestor_supplier_categories_v1', JSON.stringify(nextCats));
            } catch(e) {}
        }

        const savedRole = contributor.role_position || contributor.category || 'Membro';
        setRolePosition(savedRole);
        if (savedRole && !customRoles.includes(savedRole)) {
            const nextRoles = [...customRoles, savedRole];
            setCustomRoles(nextRoles);
            try {
                localStorage.setItem('iggestor_custom_roles_v1', JSON.stringify(nextRoles));
            } catch(e) {}
        }

        setPhone(contributor.phone || '');
        setEmail(contributor.email || '');
        setPixKey(contributor.pix_key || '');
        setBankName(contributor.bank_name || '');
        setBankAgency(contributor.bank_agency || '');
        setBankAccount(contributor.bank_account || '');
        setAddressCep(contributor.address_cep || '');
        setAddressStreet(contributor.address_street || '');
        setAddressNumber(contributor.address_number || '');
        setAddressCity(contributor.address_city || '');
        setAddressState(contributor.address_state || '');
        setNotes(contributor.notes || '');
        setStatus(contributor.status === 'inactive' ? 'Inativo' : 'Ativo');
        setIsModalOpen(true);
    };

    const handleDeleteContributor = async (id: string, name: string) => {
        if (!confirm(`Tem certeza que deseja inativar o contribuinte "${name}"?`)) {
            return;
        }
        try {
            const response = await fetch(`/api/v1/contributors/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast("Contribuinte inativado com sucesso.", "success");
                fetchContributors();
            } else {
                showToast("Falha ao inativar contribuinte.", "error");
            }
        } catch (error) {
            console.error('[ContributorsList] Error deleting contributor:', error);
            showToast("Falha ao inativar contribuinte.", "error");
        }
    };

    const handleDeletePermanent = async (id: string, name: string) => {
        if (!confirm(`ATENÇÃO: Você deseja EXCLUIR DEFINITIVAMENTE o cadastro do contribuinte "${name}"?\nEsta ação é irreversível e removerá permanentemente o cadastro do banco de dados.`)) {
            return;
        }
        try {
            // Clear from the contributors table on VPS (which now internally unlinks transactions and deletes learned associations)
            const response = await fetch(`/api/v1/contributors/${id}?hard=true`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast("Contribuinte excluído definitivamente.", "success");
                fetchContributors();
            } else {
                showToast("Falha ao excluir contribuinte definitivamente.", "error");
            }
        } catch (error) {
            console.error('[ContributorsList] Error hard deleting contributor:', error);
            showToast("Falha ao excluir contribuinte definitivamente.", "error");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (photoPreview) {
                URL.revokeObjectURL(photoPreview);
            }
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleRemovePhoto = () => {
        if (photoPreview) {
            URL.revokeObjectURL(photoPreview);
        }
        setPhotoFile(null);
        setPhotoPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingContributor(null);
        setPersonType('PF');
        setFullName('');
        setTradeName('');
        setSelectedChurchId('church-1');
        setIsGlobal(false);
        setCpf('');
        setRgIe('');
        setBirthDate('');
        setContactPerson('');
        setCategory('');
        setRolePosition('Membro');
        setPhone('');
        setEmail('');
        setPixKey('');
        setBankName('');
        setBankAgency('');
        setBankAccount('');
        setAddressCep('');
        setAddressStreet('');
        setAddressNumber('');
        setAddressCity('');
        setAddressState('');
        setNotes('');
        setStatus('Ativo');
        setAttemptedSubmit(false);

        // Reset photo state and revoke preview URL
        if (photoPreview) {
            URL.revokeObjectURL(photoPreview);
        }
        setPhotoFile(null);
        setPhotoPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setAttemptedSubmit(true);

        const trimmedName = fullName.trim();
        const isValidName = trimmedName.length > 0;
        const isValidChurch = selectedChurchId && selectedChurchId !== 'church-1';

        if (!isValidName || !isValidChurch) {
            return; // Show validation error on UI
        }

        try {
            // Normalizations as per rules
            const canonical_name = trimmedName.replace(/\s+/g, ' ').toUpperCase();
            
            const rawCpf = cpf.replace(/\D/g, '');
            const sanitizedCpf = rawCpf.length > 0 ? rawCpf : null;

            const trimmedEmail = email.trim();
            const sanitizedEmail = trimmedEmail.length > 0 ? trimmedEmail : null;

            const trimmedPhone = phone.trim();
            const sanitizedPhone = trimmedPhone.length > 0 ? trimmedPhone : null;

            const sanitizedStatus = status === 'Ativo' ? 'active' : 'inactive';

            const payload = {
                church_id: selectedChurchId,
                is_global: isGlobal,
                canonical_name,
                role_position: rolePosition || category || 'Membro',
                cpf: sanitizedCpf,
                email: sanitizedEmail,
                phone: sanitizedPhone,
                status: sanitizedStatus,
                person_type: personType,
                trade_name: tradeName.trim() || null,
                rg_ie: rgIe.trim() || null,
                birth_date: birthDate || null,
                contact_person: contactPerson.trim() || null,
                category: category || rolePosition || null,
                pix_key: pixKey.trim() || null,
                bank_name: bankName.trim() || null,
                bank_agency: bankAgency.trim() || null,
                bank_account: bankAccount.trim() || null,
                address_cep: addressCep.trim() || null,
                address_street: addressStreet.trim() || null,
                address_number: addressNumber.trim() || null,
                address_city: addressCity.trim() || null,
                address_state: addressState.trim() || null,
                notes: notes.trim() || null
            };

            let response;
            if (editingContributor) {
                response = await fetch(`/api/v1/contributors/${editingContributor.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
            } else {
                response = await fetch('/api/v1/contributors', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
            }

            if (response.status === 201 || response.status === 200) {
                showToast(editingContributor ? "Cadastro atualizado com sucesso." : "Cadastro realizado com sucesso.", "success");
                handleCloseModal();
                fetchContributors();
            } else if (response.status === 409) {
                showToast("Já existe um cadastro ativo com este CPF/CNPJ nesta igreja.", "error");
            } else if (response.status === 400) {
                const responseData = await response.json().catch(() => null);
                const errorMsg = responseData?.error || "Erro de validação. Verifique os dados.";
                showToast(errorMsg === "VALIDATION_ERROR" ? "Erro de validação nos dados enviados." : errorMsg, "error");
            } else {
                showToast("Falha ao salvar o cadastro. Tente novamente.", "error");
            }
        } catch (error) {
            console.error('[ContributorsList] Error saving contributor:', error);
            showToast("Falha ao salvar o cadastro. Tente novamente.", "error");
        }
    };

    const isNameInvalid = attemptedSubmit && !fullName.trim();
    const isChurchInvalid = attemptedSubmit && (!selectedChurchId || selectedChurchId === 'church-1');

    const filteredContributors = contributors.filter(c => {
        const query = search.toLowerCase().trim();
        if (!query) return true;

        const roleVal = c.role_position || c.category;
        const nameMatch = c.canonical_name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(query.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        const cleanQueryCpf = query.replace(/\D/g, '');
        const cpfMatch = cleanQueryCpf ? c.cpf?.replace(/\D/g, '').includes(cleanQueryCpf) : false;
        const roleQueryMatch = roleVal?.toLowerCase().includes(query);
        const tradeMatch = c.trade_name?.toLowerCase().includes(query);
        const contactMatch = c.contact_person?.toLowerCase().includes(query);
        return nameMatch || cpfMatch || roleQueryMatch || tradeMatch || contactMatch;
    });

    return (
        <div className="h-full flex flex-col animate-fade-in" id="contributors-container">
            {/* Header Area */}
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800/60">
                        <UsersIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-slate-800 dark:text-white leading-none">
                            Empresas / Pessoas
                        </h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                            Gerenciamento de membros, congregados, parceiros, fornecedores, prestadores e favorecidos.
                        </p>
                    </div>
                </div>
                
                {/* Buttons: Importar Lote & + Novo Contribuinte */}
                <div className="flex-shrink-0 flex items-center gap-2">
                    <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="w-full md:w-auto flex items-center justify-center space-x-1.5 px-5 py-2 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-2xl shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                        id="import-contributors-btn"
                    >
                        <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>Importar Lote</span>
                    </button>
                    <button 
                        onClick={handleNewContributorClick}
                        className="w-full md:w-auto flex items-center justify-center space-x-1.5 px-5 py-2 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 transition-all tracking-wider uppercase cursor-pointer"
                        id="new-contributor-btn"
                    >
                        <PlusCircleIcon className="w-3.5 h-3.5" />
                        <span>+ Nova Empresa / Pessoa</span>
                    </button>
                </div>
            </div>

            {/* Visual Search input below the header */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 flex-shrink-0">
                <div className="relative flex-1">
                    <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nome, razão social, vínculo/cargo, CPF ou CNPJ..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        className="pl-8 p-2.5 block w-full rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-brand-graphite dark:text-slate-200 focus:border-brand-blue focus:ring-brand-blue transition-all shadow-sm focus:bg-white dark:focus:bg-slate-900 text-xs font-medium outline-none" 
                        id="contributors-search"
                    />
                </div>
            </div>

            {/* Content list or empty states */}
            {isLoadingContributors ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 animate-pulse text-center">
                    <Loader2 className="w-8 h-8 text-brand-blue animate-spin mb-3" />
                    <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                        Carregando empresas / pessoas...
                    </p>
                </div>
            ) : filteredContributors.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl min-h-[250px] animate-fade-in-up">
                    <div className="p-4 bg-slate-100/80 dark:bg-slate-900 rounded-full mb-4">
                        <UsersIcon className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                        Nenhum registro encontrado.
                    </h4>
                    <p className="max-w-md text-center text-slate-500 dark:text-slate-400 text-xs leading-relaxed" id="contributors-message">
                        {search ? "Nenhum resultado corresponde à sua busca." : "Cadastre a primeira empresa ou pessoa utilizando o botão no topo direito."}
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-x-auto overflow-y-auto pr-1 custom-scrollbar" id="contributors-list-flow">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                        <thead className="bg-slate-50/50 dark:bg-slate-900/40">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Empresa / Pessoa
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Igreja Vinculada
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Documento / Contato
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="px-4 py-3 text-right text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 bg-white dark:bg-slate-900/30 font-sans">
                            {filteredContributors.map((c) => {
                                const church = churches.find((ch: any) => ch.id === c.church_id);
                                const isPJ = c.person_type === 'PJ' || (c.cpf && c.cpf.replace(/\D/g, '').length === 14);
                                return (
                                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors animate-fade-in">
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center space-x-3">
                                                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs uppercase shrink-0 select-none shadow-sm ${
                                                    isPJ 
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40' 
                                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40'
                                                }`}>
                                                    {isPJ ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                                </div>
                                                <div className="truncate max-w-[220px]">
                                                    <div className="flex items-center space-x-1.5 mb-0.5">
                                                        <span className={`inline-block px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider ${
                                                            isPJ ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                                                        }`}>
                                                            {isPJ ? 'PJ / EMPRESA' : 'PF'}
                                                        </span>
                                                        {c.category && (
                                                            <span className="inline-block px-1.5 py-0.2 rounded text-[8px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 truncate max-w-[100px]">
                                                                {c.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-tight truncate">
                                                        {c.canonical_name}
                                                    </h5>
                                                    {c.trade_name && (
                                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block truncate">
                                                            Fantasia: {c.trade_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                    {church ? church.name : 'Igreja não identificada'}
                                                </span>
                                                {c.is_global && (
                                                    <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                        <Globe className="w-3 h-3" />
                                                        Todas as Igrejas (Global)
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3.5">
                                            <div className="space-y-0.5 max-w-[220px] truncate">
                                                {c.cpf && (
                                                    <div className="text-[10px] font-mono font-medium text-slate-600 dark:text-slate-300 flex items-center">
                                                        <span className="text-[9px] font-black text-slate-400 mr-1 uppercase">
                                                            {c.cpf.replace(/\D/g, '').length === 14 ? 'CNPJ:' : 'CPF:'}
                                                        </span>
                                                        {formatCpfCnpj(c.cpf)}
                                                    </div>
                                                )}
                                                {c.contact_person && (
                                                    <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-center truncate">
                                                        <span className="text-[9px] font-black text-slate-400 mr-1 uppercase">CONTATO:</span>
                                                        <span className="truncate">{c.contact_person}</span>
                                                    </div>
                                                )}
                                                {c.phone && (
                                                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center">
                                                        <span className="text-[9px] font-black text-slate-400 mr-1 uppercase">TEL:</span>
                                                        {c.phone}
                                                    </div>
                                                )}
                                                {c.email && (
                                                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center truncate">
                                                        <span className="text-[9px] font-black text-slate-400 mr-1 uppercase">EMAIL:</span>
                                                        <span className="truncate">{c.email}</span>
                                                    </div>
                                                )}
                                                {!c.cpf && !c.phone && !c.email && !c.contact_person && (
                                                    <span className="text-[10px] italic text-slate-400">-</span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                                                c.status === 'active' 
                                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                                    : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                                            }`}>
                                                {c.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end space-x-1.5">
                                                <button 
                                                    onClick={() => handleEditClick(c)}
                                                    className="p-1 px-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                                                    title="Editar dados"
                                                >
                                                    <Edit2 className="w-2.5 h-2.5" />
                                                    <span>Editar</span>
                                                </button>

                                                {c.status === 'active' ? (
                                                    <button 
                                                        onClick={() => handleDeleteContributor(c.id, c.canonical_name)}
                                                        className="p-1 px-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-rose-50/50 hover:text-rose-600 dark:hover:bg-rose-950/20 dark:text-rose-400 text-slate-500 text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                                                        title="Inativar contribuinte"
                                                    >
                                                        <Trash2 className="w-2.5 h-2.5" />
                                                        <span>Inativar</span>
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => {
                                                            fetch(`/api/v1/contributors/${c.id}`, {
                                                                method: 'PUT',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ status: 'active' })
                                                            }).then(res => {
                                                                if (res.ok) {
                                                                    showToast("Contribuinte reativado com sucesso.", "success");
                                                                    fetchContributors();
                                                                }
                                                            });
                                                        }}
                                                        className="p-1 px-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-emerald-50/50 hover:text-emerald-600 dark:hover:bg-emerald-950/20 dark:text-emerald-400 text-slate-500 text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                                                        title="Ativar contribuinte"
                                                    >
                                                        <Loader2 className="w-2.5 h-2.5" />
                                                        <span>Ativar</span>
                                                    </button>
                                                )}

                                                <button 
                                                    onClick={() => handleDeletePermanent(c.id, c.canonical_name)}
                                                    className="p-1 px-2.5 rounded-lg border border-red-100/50 hover:bg-red-500 hover:text-white dark:border-red-900/40 dark:hover:bg-red-600 dark:text-red-400 hover:border-red-500 text-red-500 hover:text-white text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                                                    title="Excluir cadastro permanentemente"
                                                >
                                                    <Trash2 className="w-2.5 h-2.5" />
                                                    <span>Excluir</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* NEW CONTRIBUTOR MODAL */}
            {isModalOpen && (
                <div className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden" id="contributor-modal-container">
                    <form onSubmit={handleSave} className="flex flex-col h-full w-full" id="contributor-modal-form">
                        
                        {/* Modal Header */}
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-slate-700 text-white shadow-lg shadow-slate-500/20">
                                    <UsersIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase" id="contributor-modal-title">
                                        {editingContributor ? 'Editar Empresa / Pessoa' : 'Nova Empresa / Pessoa'}
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                        Gerenciamento de Pessoas, Empresas e Fornecedores
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={handleCloseModal} 
                                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors cursor-pointer" 
                                id="btn-close-contributor-modal"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body with inputs */}
                        <div className="p-6 md:p-8 flex-1 overflow-y-auto w-full">
                            <div className="space-y-6 w-full max-w-full">
                                
                                {/* TOGGLE PF / PJ */}
                                <div className="flex items-center justify-center p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl max-w-lg mx-auto mb-4 shadow-inner" id="toggle-person-type">
                                    <button
                                        type="button"
                                        onClick={() => setPersonType('PF')}
                                        className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                            personType === 'PF'
                                                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md scale-[1.01]'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                        id="btn-type-pf"
                                    >
                                        <User className="w-4 h-4" />
                                        <span>Pessoa Física (PF)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPersonType('PJ')}
                                        className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                            personType === 'PJ'
                                                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-md scale-[1.01]'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                        id="btn-type-pj"
                                    >
                                        <Building2 className="w-4 h-4" />
                                        <span>Empresa / Fornecedor (PJ)</span>
                                    </button>
                                </div>

                                {/* FOTO / LOGO DO CONTRIBUINTE */}
                                <div className="flex flex-col items-center justify-center pb-5 border-b border-slate-100 dark:border-slate-800/80" id="photo-section">
                                    <span className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-3 tracking-wide" id="lbl-photo-section">
                                        {personType === 'PF' ? 'Foto da Pessoa' : 'Logo / Marca da Empresa'}
                                    </span>
                                    
                                    <div className="relative group mb-3 shadow-md rounded-full" id="photo-avatar-wrapper">
                                        <div className="w-24 h-24 rounded-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden shadow-inner" id="photo-avatar-container">
                                            {photoPreview ? (
                                                <img 
                                                    src={photoPreview} 
                                                    alt="Preview do cadastrado" 
                                                    className="w-full h-full object-cover"
                                                    id="photo-avatar-preview"
                                                    referrerPolicy="no-referrer"
                                                />
                                            ) : personType === 'PF' ? (
                                                <User className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                                            ) : (
                                                <Building2 className="w-10 h-10 text-amber-400 dark:text-amber-600" />
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-center gap-2" id="photo-actions">
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            onChange={handleFileChange} 
                                            accept="image/*" 
                                            className="hidden" 
                                            id="photo-file-input"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl transition-all tracking-wide uppercase border border-slate-200 dark:border-slate-700 shadow-sm active:translate-y-0.2 cursor-pointer"
                                            id="btn-select-photo"
                                        >
                                            <Camera className="w-3.5 h-3.5" />
                                            <span>{personType === 'PF' ? 'Selecionar Foto' : 'Selecionar Logo'}</span>
                                        </button>
                                        
                                        {photoPreview && (
                                            <button 
                                                type="button" 
                                                onClick={handleRemovePhoto}
                                                className="flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50/50 hover:bg-rose-100/50 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 rounded-2xl transition-all tracking-wide uppercase border border-rose-200 dark:border-rose-900/40 shadow-sm active:translate-y-0.2 cursor-pointer"
                                                id="btn-remove-photo"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>Remover</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* BLOCO 1: DADOS DE IDENTIFICAÇÃO */}
                                <div className="space-y-4 bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center space-x-2 text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
                                        {personType === 'PF' ? <User className="w-4 h-4 text-blue-500" /> : <Building2 className="w-4 h-4 text-amber-500" />}
                                        <span>{personType === 'PF' ? 'Dados Pessoais & Vínculo' : 'Dados Fiscais & Corporativos'}</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Nome / Razão Social */}
                                        <div className="space-y-2">
                                            <label htmlFor="contributor-fullname" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                {personType === 'PF' ? 'Nome Completo' : 'Razão Social'} <span className="text-rose-500">*</span>
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-fullname" 
                                                value={fullName} 
                                                onChange={(e) => setFullName(e.target.value)} 
                                                placeholder={personType === 'PF' ? 'Ex: João da Silva' : 'Ex: ABC Materiais de Construção LTDA'}
                                                className={`block w-full rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none transition-all font-bold ${
                                                    isNameInvalid 
                                                        ? 'border-2 border-rose-500 focus:border-rose-500' 
                                                        : 'border border-slate-200 dark:border-slate-700 focus:border-brand-blue'
                                                }`}
                                            />
                                            {isNameInvalid && (
                                                <p className="text-rose-500 text-[10px] font-semibold mt-1">
                                                    Campo obrigatório.
                                                </p>
                                            )}
                                        </div>

                                        {/* Nome Fantasia (Apenas PJ) ou Vínculo / Cargo (PF) */}
                                        {personType === 'PJ' ? (
                                            <div className="space-y-2">
                                                <label htmlFor="contributor-tradename" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                    Nome Fantasia
                                                </label>
                                                <input 
                                                    type="text" 
                                                    id="contributor-tradename" 
                                                    value={tradeName} 
                                                    onChange={(e) => setTradeName(e.target.value)} 
                                                    placeholder="Ex: Depósito ABC"
                                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none transition-all focus:border-brand-blue font-bold"
                                                />
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <label htmlFor="contributor-role-position" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                    Vínculo / Cargo
                                                </label>
                                                <InlineRoleSelector
                                                    value={rolePosition}
                                                    onChange={(val) => {
                                                        setRolePosition(val);
                                                        setCategory(val);
                                                    }}
                                                    roles={customRoles}
                                                    onAddRole={handleAddRole}
                                                    onRenameRole={handleRenameRole}
                                                    onDeleteRole={handleDeleteRole}
                                                    themeColor="amber"
                                                    itemLabel="Vínculo/Cargo"
                                                    placeholder="Selecione o vínculo ou cargo..."
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* CPF / CNPJ */}
                                        <div className="space-y-2">
                                            <label htmlFor="contributor-cpf" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                {personType === 'PF' ? 'CPF' : 'CNPJ'}
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-cpf" 
                                                value={cpf} 
                                                onChange={(e) => setCpf(e.target.value)} 
                                                placeholder={personType === 'PF' ? '000.000.000-00' : '00.000.000/0001-00'}
                                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                            />
                                        </div>

                                        {/* RG / IE */}
                                        <div className="space-y-2">
                                            <label htmlFor="contributor-rg-ie" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                {personType === 'PF' ? 'RG' : 'Inscrição Estadual (IE)'}
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-rg-ie" 
                                                value={rgIe} 
                                                onChange={(e) => setRgIe(e.target.value)} 
                                                placeholder={personType === 'PF' ? '00.000.000-0' : 'Isento ou número da IE'}
                                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                            />
                                        </div>

                                        {/* Data de Nasc (PF) ou Contato Responsável (PJ) */}
                                        {personType === 'PF' ? (
                                            <div className="space-y-2">
                                                <label htmlFor="contributor-birth" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                    Data de Nascimento
                                                </label>
                                                <input 
                                                    type="date" 
                                                    id="contributor-birth" 
                                                    value={birthDate} 
                                                    onChange={(e) => setBirthDate(e.target.value)} 
                                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                                />
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <label htmlFor="contributor-contact-person" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                    Pessoa de Contato / Vendedor
                                                </label>
                                                <input 
                                                    type="text" 
                                                    id="contributor-contact-person" 
                                                    value={contactPerson} 
                                                    onChange={(e) => setContactPerson(e.target.value)} 
                                                    placeholder="Ex: Carlos (Gerente de Vendas)"
                                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Se for PJ, Categoria de Fornecedor */}
                                    {personType === 'PJ' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label htmlFor="contributor-pj-category" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                    Ramo de Atuação / Categoria do Fornecedor
                                                </label>
                                                <InlineRoleSelector
                                                    value={category}
                                                    onChange={(val) => setCategory(val)}
                                                    roles={supplierCategories}
                                                    onAddRole={handleAddSupplierCategory}
                                                    onRenameRole={handleRenameSupplierCategory}
                                                    onDeleteRole={handleDeleteSupplierCategory}
                                                    themeColor="emerald"
                                                    itemLabel="Categoria"
                                                    placeholder="Selecione o ramo de atuação..."
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label htmlFor="contributor-church" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                    Igreja <span className="text-rose-500">*</span>
                                                </label>
                                                <select 
                                                    id="contributor-church" 
                                                    value={selectedChurchId} 
                                                    onChange={(e) => setSelectedChurchId(e.target.value)} 
                                                    className={`block w-full rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold ${
                                                        isChurchInvalid 
                                                            ? 'border-2 border-rose-500' 
                                                            : 'border border-slate-200 dark:border-slate-700'
                                                    }`}
                                                >
                                                    {tempChurches.map((church) => (
                                                        <option key={church.id} value={church.id}>
                                                            {church.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* Se for PF, Igreja e Status na mesma linha */}
                                    {personType === 'PF' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label htmlFor="contributor-church" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                    Igreja <span className="text-rose-500">*</span>
                                                </label>
                                                <select 
                                                    id="contributor-church" 
                                                    value={selectedChurchId} 
                                                    onChange={(e) => setSelectedChurchId(e.target.value)} 
                                                    className={`block w-full rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold ${
                                                        isChurchInvalid 
                                                            ? 'border-2 border-rose-500' 
                                                            : 'border border-slate-200 dark:border-slate-700'
                                                    }`}
                                                >
                                                    {tempChurches.map((church) => (
                                                        <option key={church.id} value={church.id}>
                                                            {church.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <label htmlFor="contributor-status" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                    Status do Cadastro
                                                </label>
                                                <select 
                                                    id="contributor-status" 
                                                    value={status} 
                                                    onChange={(e) => setStatus(e.target.value as 'Ativo' | 'Inativo')} 
                                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                                >
                                                    <option value="Ativo">Ativo</option>
                                                    <option value="Inativo">Inativo</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                    {/* OPÇÃO DE COMPARTILHAMENTO GLOBAL ENTRE TODAS AS IGREJAS */}
                                    <div className="mt-3 p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3" id="global-share-card">
                                        <div className="flex items-start space-x-2.5">
                                            <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                                                    Tornar disponível para todas as Igrejas (Cadastro Global)
                                                </span>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                                    {isPrincipalUser 
                                                        ? "Permite lançar despesas, doações ou serviços desta pessoa/empresa em qualquer igreja do sistema."
                                                        : "Recurso restrito ao Usuário Principal para disponibilizar fornecedores/pessoas em todas as igrejas."}
                                                </span>
                                            </div>
                                        </div>
                                        {isPrincipalUser ? (
                                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 self-start sm:self-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isGlobal} 
                                                    onChange={(e) => setIsGlobal(e.target.checked)} 
                                                    className="sr-only peer"
                                                    id="chk-contributor-is-global"
                                                />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                            </label>
                                        ) : (
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg flex-shrink-0">
                                                Somente Usuário Principal
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* BLOCO 2: CONTATO */}
                                <div className="space-y-4 bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center space-x-2 text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
                                        <Phone className="w-4 h-4 text-emerald-500" />
                                        <span>Contato & Comunicação</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label htmlFor="contributor-phone" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                {personType === 'PF' ? 'Telefone / WhatsApp' : 'Telefone Comercial / WhatsApp'}
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-phone" 
                                                value={phone} 
                                                onChange={(e) => setPhone(e.target.value)} 
                                                placeholder="(00) 00000-0000"
                                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="contributor-email" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                {personType === 'PF' ? 'E-mail Pessoal' : 'E-mail Oficial / NFe'}
                                            </label>
                                            <input 
                                                type="email" 
                                                id="contributor-email" 
                                                value={email} 
                                                onChange={(e) => setEmail(e.target.value)} 
                                                placeholder="exemplo@contato.com"
                                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* BLOCO 3: ENDEREÇO */}
                                <div className="space-y-4 bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center space-x-2 text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
                                        <MapPin className="w-4 h-4 text-purple-500" />
                                        <span>{personType === 'PF' ? 'Endereço Residencial' : 'Endereço da Sede / Filial'}</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="space-y-2">
                                            <label htmlFor="contributor-cep" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                CEP
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-cep" 
                                                value={addressCep} 
                                                onChange={(e) => setAddressCep(e.target.value)} 
                                                placeholder="00000-000"
                                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                            />
                                        </div>

                                        <div className="md:col-span-2 space-y-2">
                                            <label htmlFor="contributor-street" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                Logradouro / Endereço
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-street" 
                                                value={addressStreet} 
                                                onChange={(e) => setAddressStreet(e.target.value)} 
                                                placeholder="Ex: Rua das Flores, Av. Central"
                                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="contributor-number" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                Número / Bairro
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-number" 
                                                value={addressNumber} 
                                                onChange={(e) => setAddressNumber(e.target.value)} 
                                                placeholder="Nº 123, Bairro Centro"
                                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="md:col-span-2 space-y-2">
                                            <label htmlFor="contributor-city" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                Cidade
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-city" 
                                                value={addressCity} 
                                                onChange={(e) => setAddressCity(e.target.value)} 
                                                placeholder="Ex: São Paulo"
                                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="contributor-state" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                UF / Estado
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-state" 
                                                value={addressState} 
                                                onChange={(e) => setAddressState(e.target.value.toUpperCase())} 
                                                placeholder="SP"
                                                maxLength={2}
                                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold uppercase"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* BLOCO 4: DADOS BANCÁRIOS & PIX */}
                                <div className="space-y-4 bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center space-x-2 text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
                                        <Landmark className="w-4 h-4 text-cyan-500" />
                                        <span>Dados Bancários & Chave Pix (Para Pagamentos/Transferências)</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label htmlFor="contributor-pix" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                Chave Pix Principal
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-pix" 
                                                value={pixKey} 
                                                onChange={(e) => setPixKey(e.target.value)} 
                                                placeholder="E-mail, CPF/CNPJ, Telefone ou Chave Aleatória"
                                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="contributor-bankname" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                Banco
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-bankname" 
                                                value={bankName} 
                                                onChange={(e) => setBankName(e.target.value)} 
                                                placeholder="Ex: Itaú, Bradesco, Banco do Brasil, Nubank"
                                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label htmlFor="contributor-bankagency" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                Agência
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-bankagency" 
                                                value={bankAgency} 
                                                onChange={(e) => setBankAgency(e.target.value)} 
                                                placeholder="0000"
                                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="contributor-bankaccount" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                                Conta Corrente / Poupança
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-bankaccount" 
                                                value={bankAccount} 
                                                onChange={(e) => setBankAccount(e.target.value)} 
                                                placeholder="00000-0"
                                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* BLOCO 5: OBSERVAÇÕES */}
                                <div className="space-y-2 bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <label htmlFor="contributor-notes" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                        Observações / Anotações Internas
                                    </label>
                                    <textarea 
                                        id="contributor-notes" 
                                        value={notes} 
                                        onChange={(e) => setNotes(e.target.value)} 
                                        rows={3}
                                        placeholder="Anotações sobre condições de pagamento, contratos ou histórico de fornecimento..."
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm text-xs p-3.5 outline-none font-medium resize-none"
                                    />
                                </div>

                            </div>
                        </div>

                        {/* Modal Actions Footer */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800/50 mt-auto" id="contributor-modal-actions">
                            <button 
                                type="button" 
                                onClick={handleCloseModal} 
                                className="px-6 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-2xl shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer" 
                                id="btn-cancel-contributor"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                className="px-8 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                                id="btn-save-contributor"
                            >
                                Salvar
                            </button>
                        </div>

                    </form>
                </div>
            )}

            {/* BATCH IMPORT MODAL */}
            {isImportModalOpen && (
                <div className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden" id="import-modal-container">
                    
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl shadow-lg shadow-emerald-500/10">
                                <Sparkles className="w-6 h-6 animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                    Importar Empresas / Pessoas em Lote
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                    Extraia dados diretamente de arquivos OFX, CSV, TXT ou Planilhas Excel.
                                </p>
                            </div>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => {
                                setIsImportModalOpen(false);
                                setImportFile(null);
                                setParsedContributors([]);
                            }} 
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors cursor-pointer"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-8 flex-1 overflow-y-auto w-full">
                        <div className="space-y-6 w-full">
                            {!importFile ? (
                                /* Drag and Drop / Select File Zone */
                                <div className="flex flex-col items-center justify-center">
                                    <div 
                                        onClick={() => importFileInputRef.current?.click()}
                                        className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-brand-blue dark:hover:border-brand-blue/60 bg-slate-50/50 dark:bg-slate-900/20 rounded-[2rem] p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-[1.01] group"
                                    >
                                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm text-slate-400 dark:text-slate-500 group-hover:text-brand-blue transition-colors mb-4">
                                            <FileUp className="w-8 h-8" />
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                                            Carregar arquivo do extrato ou lista
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-3">
                                            Selecione um extrato <span className="font-bold">OFX</span>, arquivo <span className="font-bold">CSV/TXT</span> ou planilha <span className="font-bold">Excel</span> contendo os nomes, razões sociais, CPFs ou CNPJs.
                                        </p>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 tracking-wider">
                                            Processamento 100% Local e Seguro
                                        </span>
                                    </div>
                                    <input 
                                        type="file"
                                        ref={importFileInputRef}
                                        onChange={handleImportFileChange}
                                        accept=".ofx,.csv,.txt,.xlsx,.xls"
                                        className="hidden"
                                    />
                                </div>
                            ) : isLoadingImport ? (
                                /* Loading Parse State */
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Loader2 className="w-10 h-10 text-brand-blue animate-spin mb-4" />
                                    <h5 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                        Analisando documento localmente...
                                    </h5>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Mapeando registros, normalizando nomes e detectando CPFs.
                                    </p>
                                </div>
                            ) : (
                                /* Review & Edit State */
                                <div className="space-y-6">
                                    {/* Default Church selection */}
                                    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div>
                                            <label className="block text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                                                Igreja de Destino
                                            </label>
                                            <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                                                Selecione a igreja à qual estas empresas ou pessoas pertencem.
                                            </p>
                                        </div>
                                        <select
                                            value={defaultImportChurchId}
                                            onChange={(e) => setDefaultImportChurchId(e.target.value)}
                                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-brand-graphite dark:text-slate-200 text-xs font-bold p-2.5 outline-none focus:border-brand-blue focus:ring-brand-blue cursor-pointer min-w-[200px]"
                                        >
                                            {tempChurches.filter(c => c.id !== 'church-1').map((church) => (
                                                <option key={church.id} value={church.id}>
                                                    {church.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Summary Stats */}
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800/50 pb-2">
                                        <span>Registros Encontrados: {parsedContributors.length}</span>
                                        <div className="flex space-x-3">
                                            <span className="text-emerald-600">
                                                Novos: {parsedContributors.filter(c => !checkDuplicate(c.cpf, c.name, defaultImportChurchId)).length}
                                            </span>
                                            <span className="text-amber-500">
                                                Duplicados (pulados): {parsedContributors.filter(c => checkDuplicate(c.cpf, c.name, defaultImportChurchId)).length}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Contributors Editable Table */}
                                    <div className="overflow-x-auto max-h-[35vh] border border-slate-100 dark:border-slate-800 rounded-2xl custom-scrollbar">
                                        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-xs font-bold uppercase">
                                            <thead className="bg-slate-50/50 dark:bg-slate-900/40 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-2 text-left font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">
                                                        Nome / Razão Social
                                                    </th>
                                                    <th className="px-4 py-2 text-left font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[9px]">
                                                        CPF / CNPJ Identificado
                                                    </th>
                                                    <th className="px-4 py-2 text-right font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[9px] w-[110px]">
                                                        Situação
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 bg-white dark:bg-slate-900/30">
                                                {parsedContributors.map((c, idx) => {
                                                    const isDup = checkDuplicate(c.cpf, c.name, defaultImportChurchId);
                                                    return (
                                                        <tr key={c.id} className="hover:bg-slate-50/20">
                                                            <td className="px-4 py-2">
                                                                <input
                                                                    type="text"
                                                                    value={c.name}
                                                                    onChange={(e) => {
                                                                        const updated = [...parsedContributors];
                                                                        updated[idx].name = e.target.value;
                                                                        setParsedContributors(updated);
                                                                    }}
                                                                    disabled={isDup}
                                                                    className={`w-full bg-transparent p-1 border-b rounded transition-colors text-xs font-bold uppercase ${
                                                                        isDup 
                                                                            ? 'text-slate-400 border-transparent cursor-not-allowed' 
                                                                            : 'text-slate-700 dark:text-slate-200 border-slate-100 dark:border-slate-800 focus:border-brand-blue outline-none'
                                                                    }`}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <input
                                                                    type="text"
                                                                    value={c.cpf}
                                                                    onChange={(e) => {
                                                                        const updated = [...parsedContributors];
                                                                        updated[idx].cpf = e.target.value;
                                                                        setParsedContributors(updated);
                                                                    }}
                                                                    disabled={isDup}
                                                                    placeholder="Sem CPF/CNPJ"
                                                                    className={`w-full bg-transparent p-1 border-b rounded transition-colors text-xs font-mono font-bold ${
                                                                        isDup 
                                                                            ? 'text-slate-400 border-transparent cursor-not-allowed' 
                                                                            : 'text-slate-700 dark:text-slate-200 border-slate-100 dark:border-slate-800 focus:border-brand-blue outline-none'
                                                                    }`}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                {isDup ? (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40 uppercase">
                                                                        <AlertTriangle className="w-2.5 h-2.5" />
                                                                        Duplicado
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 uppercase">
                                                                        <Check className="w-2.5 h-2.5" />
                                                                        Novo
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-relaxed italic">
                                        * Linhas marcadas como "Duplicado" possuem CPF/CNPJ ou Nome idênticos a cadastros já ativos nesta igreja e serão pulados automaticamente para evitar duplicidade.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-between items-center border-t border-slate-100 dark:border-slate-800/50 mt-auto">
                        <div>
                            {isImporting && (
                                <div className="text-left">
                                    <p className="text-[10px] font-black uppercase text-brand-blue tracking-wider">
                                        Importando {importProgress.current} de {importProgress.total}...
                                    </p>
                                    <div className="w-32 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                        <div 
                                            className="bg-brand-blue h-full rounded-full transition-all duration-300" 
                                            style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex space-x-3">
                            <button 
                                type="button" 
                                onClick={() => {
                                    setIsImportModalOpen(false);
                                    setImportFile(null);
                                    setParsedContributors([]);
                                }} 
                                disabled={isImporting}
                                className="px-6 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-2xl shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50"
                            >
                                {importFile ? 'Voltar' : 'Fechar'}
                            </button>
                            {importFile && !isLoadingImport && (
                                <button 
                                    type="button" 
                                    onClick={handleExecuteImport}
                                    disabled={isImporting || parsedContributors.filter(c => !checkDuplicate(c.cpf, c.name, defaultImportChurchId)).length === 0}
                                    className="px-8 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {isImporting ? 'Cadastrando...' : 'Confirmar Cadastro'}
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};
