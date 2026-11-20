import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getCachedContributors, invalidateContributorsCache, notifyContributorUpdated, subscribeToContributorUpdates } from '../../services/contributorsCache';
import { formatDateToDmy, formatDateToYmd } from '../../portal/utils/portalFormatters';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { UsersIcon, PlusCircleIcon, SearchIcon, XMarkIcon } from '../Icons';
import { Camera, Trash2, Edit2, Loader2, Upload, Check, AlertTriangle, FileUp, Sparkles, User, Building2, Landmark, MapPin, Phone, Mail, FileText, Tag, Calendar, ShieldCheck, Globe, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { InlineRoleSelector } from './InlineRoleSelector';
import { getAuthToken } from '../../services/auth/authAdapter';

const formatCpfCnpj = (value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length === 11) {
        return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (clean.length === 14) {
        return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return value;
};

const authFetch = async (url: string, init: RequestInit = {}) => {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
        ...(init.headers as Record<string, string> || {})
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, { ...init, headers });
};

export const ContributorsList: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
    const { showToast } = useUI();
    const {
        churches,
        customRoles = [],
        supplierCategories = [],
        addTenantOption,
        renameTenantOption,
        deleteTenantOption,
        openDeleteConfirmation
    } = useContext(AppContext);
    const { subscription, user, isSecondaryUser } = useAuth();
    
    // Principal User check: owner, admin, principal or ownerId matching user.id (strictly false for secondary users)
    const isPrincipalUser = !isSecondaryUser && (!subscription?.role || subscription?.role === 'owner' || subscription?.role === 'admin' || subscription?.role === 'principal' || subscription?.ownerId === user?.id);
    
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedChurchFilter, setSelectedChurchFilter] = useState<string>('all');
    const [displayLimit, setDisplayLimit] = useState<number>(60);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [contributors, setContributors] = useState<any[]>([]);
    const [isLoadingContributors, setIsLoadingContributors] = useState<boolean>(true);
    const [editingContributor, setEditingContributor] = useState<any | null>(null);

    // Debounce search input to avoid re-filtering on every keystroke
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setDisplayLimit(60);
        }, 150);
        return () => clearTimeout(timer);
    }, [search]);

    // Reset page limit on church filter change
    useEffect(() => {
        setDisplayLimit(60);
    }, [selectedChurchFilter]);
    
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
    
    const [rolePosition, setRolePosition] = useState<string>('Membro');

    const handleAddRole = async (newRole: string) => {
        const trimmed = newRole.trim();
        if (!trimmed) return;
        const ok = addTenantOption ? await addTenantOption('contributor_role', trimmed) : true;
        if (ok) {
            setRolePosition(trimmed);
            setCategory(trimmed);
        }
    };

    const handleRenameRole = async (oldRole: string, newRole: string) => {
        const trimmed = newRole.trim();
        if (!trimmed) return;
        const ok = renameTenantOption ? await renameTenantOption('contributor_role', oldRole, trimmed) : true;
        if (ok && rolePosition === oldRole) {
            setRolePosition(trimmed);
            setCategory(trimmed);
        }
    };

    const handleDeleteRole = async (roleToDelete: string) => {
        const ok = deleteTenantOption ? await deleteTenantOption('contributor_role', roleToDelete) : true;
        if (ok && rolePosition === roleToDelete) {
            setRolePosition('');
            setCategory('');
        }
    };

    const handleAddSupplierCategory = async (newCat: string) => {
        const trimmed = newCat.trim();
        if (!trimmed) return;
        const ok = addTenantOption ? await addTenantOption('supplier_category', trimmed) : true;
        if (ok) {
            setCategory(trimmed);
        }
    };

    const handleRenameSupplierCategory = async (oldCat: string, newCat: string) => {
        const trimmed = newCat.trim();
        if (!trimmed) return;
        const ok = renameTenantOption ? await renameTenantOption('supplier_category', oldCat, trimmed) : true;
        if (ok && category === oldCat) {
            setCategory(trimmed);
        }
    };

    const handleDeleteSupplierCategory = async (catToDelete: string) => {
        const ok = deleteTenantOption ? await deleteTenantOption('supplier_category', catToDelete) : true;
        if (ok && category === catToDelete) {
            setCategory('');
        }
    };

    const availableCustomRoles = useMemo(() => {
        if (rolePosition && !customRoles.includes(rolePosition)) {
            return [...customRoles, rolePosition];
        }
        return customRoles;
    }, [customRoles, rolePosition]);

    const availableSupplierCategories = useMemo(() => {
        if (category && !supplierCategories.includes(category)) {
            return [...supplierCategories, category];
        }
        return supplierCategories;
    }, [supplierCategories, category]);

    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankAgency, setBankAgency] = useState('');
    const [bankAccount, setBankAccount] = useState('');
    const [showBankDetails, setShowBankDetails] = useState(false);
    const [addressCep, setAddressCep] = useState('');
    const [addressStreet, setAddressStreet] = useState('');
    const [addressNumber, setAddressNumber] = useState('');
    const [addressCity, setAddressCity] = useState('');
    const [addressState, setAddressState] = useState('');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
    const [attemptedSubmit, setAttemptedSubmit] = useState(false);

    // Photo States
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const convertFileToDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 600;

                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                        resolve(dataUrl);
                    } else {
                        resolve(e.target?.result as string);
                    }
                };
                img.onerror = () => {
                    resolve(e.target?.result as string);
                };
                img.src = e.target?.result as string;
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    };

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
        if (churches && churches.length > 0) {
            if (!defaultImportChurchId) {
                setDefaultImportChurchId(churches[0].id);
            }
            if (!selectedChurchId || selectedChurchId === 'church-1') {
                setSelectedChurchId(churches[0].id);
            }
        }
    }, [churches, defaultImportChurchId, selectedChurchId]);

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

        // 🛡️ Regra Estrita: Apenas importar cadastros com Nome e CPF/CNPJ válido (11 ou 14 dígitos)
        const validParsed = parsedContributors.filter(c => {
            const rawCpf = (c.cpf || '').replace(/\D/g, '');
            const hasCpf = rawCpf.length === 11 || rawCpf.length === 14;
            const hasName = c.name && c.name.trim().length > 0;
            return hasCpf && hasName;
        });

        if (validParsed.length === 0) {
            showToast("Nenhum contribuinte do arquivo possui CPF/CNPJ (11 ou 14 dígitos) e Nome válidos.", "error");
            return;
        }

        const toImport = validParsed.filter(c => !checkDuplicate(c.cpf, c.name, defaultImportChurchId));
        if (toImport.length === 0) {
            showToast("Todos os contribuintes com CPF/CNPJ válido já estão cadastrados nesta igreja.", "error");
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

                const response = await authFetch('/api/v1/contributors', {
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
        invalidateContributorsCache();
        fetchContributors(true);
        notifyContributorUpdated();
    };

    // Real list of churches from context
    const tempChurches = [
        { id: 'church-1', name: 'Selecione uma igreja' },
        ...churches.map((c: any) => ({ id: c.id, name: c.name }))
    ];

    const [isRepairingChurches, setIsRepairingChurches] = useState(false);

    const handleRepairChurchNames = async () => {
        setIsRepairingChurches(true);
        try {
            const res = await authFetch('/api/v1/contributors/repair-churches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showToast(data.message || "Cadastros sincronizados com suas igrejas!", "success");
                invalidateContributorsCache();
                fetchContributors(true);
                notifyContributorUpdated();
            } else {
                showToast(data.message || "Erro ao sincronizar igrejas dos cadastros.", "error");
            }
        } catch (err) {
            console.error('[ContributorsList] Erro ao sincronizar igrejas:', err);
            showToast("Erro ao conectar com o servidor.", "error");
        } finally {
            setIsRepairingChurches(false);
        }
    };

    const fetchContributors = async (forceRefresh = false) => {
        try {
            setIsLoadingContributors(true);
            const data = await getCachedContributors(forceRefresh);
            // 🛡️ Preserva todos os cadastros válidos (com nome preenchido) e normaliza congregação padrão
            const validOnly = (Array.isArray(data) ? data : [])
                .filter((c: any) => Boolean((c.canonical_name || c.name) && String(c.canonical_name || c.name).trim()))
                .map((c: any) => {
                    const matchedChurch = churches.find((ch: any) => ch.id === c.church_id || (c.congregation && ch.name && ch.name.trim().toLowerCase() === c.congregation.trim().toLowerCase()));
                    const effectiveChurchId = (!c.church_id || c.church_id === 'church-1') 
                        ? (matchedChurch?.id || churches[0]?.id || '00000000-0000-0000-0000-000000000001') 
                        : c.church_id;
                    const effectiveChurchName = matchedChurch?.name || churches.find((ch: any) => ch.id === effectiveChurchId)?.name || churches[0]?.name || 'Igreja Sede / Matriz';
                    const effectiveCongregation = (!c.congregation || c.congregation === 'Igreja' || c.congregation === 'Igreja não identificada')
                        ? effectiveChurchName
                        : c.congregation;

                    return {
                        ...c,
                        church_id: effectiveChurchId,
                        congregation: effectiveCongregation
                    };
                });
            setContributors(validOnly);
        } catch (error) {
            console.error('[ContributorsList] Error fetching contributors:', error);
        } finally {
            setIsLoadingContributors(false);
        }
    };

    useEffect(() => {
        fetchContributors(false);

        const unsubscribe = subscribeToContributorUpdates(() => {
            fetchContributors(true);
        });

        return () => {
            unsubscribe();
        };
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
        setBirthDate(formatDateToYmd(contributor.birth_date));
        setContactPerson(contributor.contact_person || '');

        const savedCat = contributor.category || '';
        setCategory(savedCat);

        const savedRole = contributor.role_position || contributor.category || 'Membro';
        setRolePosition(savedRole);

        setPhone(contributor.phone || '');
        setEmail(contributor.email || '');
        setPixKey(contributor.pix_key || '');
        setBankName(contributor.bank_name || '');
        setBankAgency(contributor.bank_agency || '');
        setBankAccount(contributor.bank_account || '');
        
        const hasExistingBankData = Boolean(
            (contributor.pix_key && contributor.pix_key.trim()) ||
            (contributor.bank_name && contributor.bank_name.trim()) ||
            (contributor.bank_agency && contributor.bank_agency.trim()) ||
            (contributor.bank_account && contributor.bank_account.trim())
        );
        setShowBankDetails(hasExistingBankData);

        setAddressCep(contributor.address_cep || '');
        setAddressStreet(contributor.address_street || '');
        setAddressNumber(contributor.address_number || '');
        setAddressCity(contributor.address_city || '');
        setAddressState(contributor.address_state || '');
        setNotes(contributor.notes || '');
        setStatus(contributor.status === 'inactive' ? 'Inativo' : 'Ativo');

        const existingPhoto = contributor.photo_url || contributor.photo || contributor.photoUrl || contributor.avatarUrl || null;
        setPhotoPreview(existingPhoto);
        setPhotoFile(null);

        setIsModalOpen(true);
    };

    const handleDeleteContributor = (id: string, name: string) => {
        openDeleteConfirmation({
            type: 'contributor-inactivate',
            id,
            name,
            meta: {
                confirmLabel: 'Inativar',
                onConfirm: async () => {
                    try {
                        const response = await authFetch(`/api/v1/contributors/${id}`, {
                            method: 'DELETE'
                        });
                        if (response.ok) {
                            showToast("Contribuinte inativado com sucesso.", "success");
                            invalidateContributorsCache();
                            fetchContributors(true);
                            notifyContributorUpdated();
                        } else {
                            showToast("Falha ao inativar contribuinte.", "error");
                        }
                    } catch (error) {
                        console.error('[ContributorsList] Error deleting contributor:', error);
                        showToast("Falha ao inativar contribuinte.", "error");
                    }
                }
            }
        });
    };

    const handleDeletePermanent = (id: string, name: string) => {
        openDeleteConfirmation({
            type: 'contributor-permanent',
            id,
            name,
            meta: {
                confirmLabel: 'Excluir Definitivamente',
                onConfirm: async () => {
                    try {
                        // Clear from the contributors table on VPS (which now internally unlinks transactions and deletes learned associations)
                        const response = await authFetch(`/api/v1/contributors/${id}?hard=true`, {
                            method: 'DELETE'
                        });
                        if (response.ok) {
                            showToast("Contribuinte excluído definitivamente.", "success");
                            invalidateContributorsCache();
                            fetchContributors(true);
                            notifyContributorUpdated();
                        } else {
                            showToast("Falha ao excluir contribuinte definitivamente.", "error");
                        }
                    } catch (error) {
                        console.error('[ContributorsList] Error hard deleting contributor:', error);
                        showToast("Falha ao excluir contribuinte definitivamente.", "error");
                    }
                }
            }
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const dataUrl = await convertFileToDataUrl(file);
                setPhotoFile(file);
                setPhotoPreview(dataUrl);
            } catch (err) {
                console.error('[ContributorsList] Error processing photo:', err);
                showToast("Erro ao processar imagem da foto. Tente outra imagem.", "error");
            }
        }
    };

    const handleRemovePhoto = () => {
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
        setSelectedChurchId(churches && churches.length > 0 ? churches[0].id : '00000000-0000-0000-0000-000000000001');
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
        setShowBankDetails(false);
        setAddressCep('');
        setAddressStreet('');
        setAddressNumber('');
        setAddressCity('');
        setAddressState('');
        setNotes('');
        setStatus('Ativo');
        setAttemptedSubmit(false);

        // Reset photo state
        setPhotoFile(null);
        setPhotoPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    useEffect(() => {
        if (!isModalOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.stopImmediatePropagation();
                handleCloseModal();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [isModalOpen]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setAttemptedSubmit(true);

        const trimmedName = fullName.trim();
        const isValidName = trimmedName.length > 0;
        const effectiveChurchId = (selectedChurchId && selectedChurchId !== 'church-1') 
            ? selectedChurchId 
            : (churches && churches.length > 0 ? churches[0].id : '00000000-0000-0000-0000-000000000001');
        const isValidChurch = Boolean(effectiveChurchId);
        const rawCpf = cpf.replace(/\D/g, '');
        const isValidCpfCnpj = rawCpf.length === 11 || rawCpf.length === 14;

        if (!isValidName || !isValidChurch || !isValidCpfCnpj) {
            if (!isValidCpfCnpj) {
                showToast(`Por favor, preencha o ${personType === 'PF' ? 'CPF com 11 dígitos' : 'CNPJ com 14 dígitos'} obrigatório.`, "error");
            } else if (!isValidName) {
                showToast("Por favor, preencha o Nome Completo / Razão Social.", "error");
            } else if (!isValidChurch) {
                showToast("Por favor, selecione uma Igreja de vinculação válida.", "error");
            }
            return;
        }

        try {
            // Normalizations as per rules
            const canonical_name = trimmedName.replace(/\s+/g, ' ').toUpperCase();
            
            const sanitizedCpf = rawCpf;

            const trimmedEmail = email.trim();
            const sanitizedEmail = trimmedEmail.length > 0 ? trimmedEmail : null;

            const trimmedPhone = phone.trim();
            const sanitizedPhone = trimmedPhone.length > 0 ? trimmedPhone : null;

            const sanitizedStatus = status === 'Ativo' ? 'active' : 'inactive';
            const foundChurch = churches.find((c: any) => c.id === effectiveChurchId);
            const churchNameForContrib = foundChurch?.name || null;

            const payload = {
                church_id: effectiveChurchId,
                is_global: isPrincipalUser ? isGlobal : (editingContributor ? Boolean(editingContributor.is_global) : false),
                canonical_name,
                congregation: churchNameForContrib,
                role_position: rolePosition || category || 'Membro',
                cpf: sanitizedCpf,
                email: sanitizedEmail,
                phone: sanitizedPhone,
                status: sanitizedStatus,
                person_type: personType,
                trade_name: tradeName.trim() || null,
                rg_ie: rgIe.trim() || null,
                birth_date: formatDateToDmy(birthDate) || null,
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
                notes: notes.trim() || null,
                photo_url: photoPreview || null
            };

            let response;
            if (editingContributor) {
                response = await authFetch(`/api/v1/contributors/${editingContributor.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
            } else {
                response = await authFetch('/api/v1/contributors', {
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
                invalidateContributorsCache();
                fetchContributors(true);

                // Seamlessly sync portal profile in localStorage if it corresponds to the edited contributor
                try {
                    const portalRaw = localStorage.getItem('iggestor_portal_contributor');
                    if (portalRaw) {
                        const portalParsed = JSON.parse(portalRaw);
                        const cleanPayloadCpf = payload.cpf ? String(payload.cpf).replace(/\D/g, '') : '';
                        const cleanPortalCpf = portalParsed.cpf ? String(portalParsed.cpf).replace(/\D/g, '') : '';
                        const isSameId = Boolean(editingContributor?.id && portalParsed.id === editingContributor.id);
                        const isSameCpf = Boolean(cleanPayloadCpf && cleanPortalCpf && cleanPayloadCpf === cleanPortalCpf);

                        if (isSameId || isSameCpf) {
                            const updatedPortal = {
                                ...portalParsed,
                                ...payload,
                                name: fullName.trim() || payload.canonical_name || portalParsed.name,
                                canonical_name: payload.canonical_name || portalParsed.canonical_name,
                                photo_url: payload.photo_url !== undefined ? payload.photo_url : portalParsed.photo_url,
                                avatarUrl: payload.photo_url !== undefined ? payload.photo_url : portalParsed.photo_url,
                                updated_at: new Date().toISOString()
                            };
                            localStorage.setItem('iggestor_portal_contributor', JSON.stringify(updatedPortal));
                        }
                    }
                    notifyContributorUpdated(payload);
                } catch (_) {}
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
    const cleanFormCpf = cpf.replace(/\D/g, '');
    const isCpfInvalid = attemptedSubmit && (cleanFormCpf.length !== 11 && cleanFormCpf.length !== 14);

    // Metrics counters memoized
    const { totalContributorsCount, pfContributorsCount, pjContributorsCount } = useMemo(() => {
        const total = contributors.length;
        let pf = 0;
        let pj = 0;
        for (let i = 0; i < total; i++) {
            const c = contributors[i];
            const isPJ = c.person_type === 'PJ' || (c.cpf && c.cpf.replace(/\D/g, '').length === 14);
            if (isPJ) {
                pj++;
            } else {
                pf++;
            }
        }
        return { totalContributorsCount: total, pfContributorsCount: pf, pjContributorsCount: pj };
    }, [contributors]);

    // CPF duplicate detection in form modal memoized
    const cleanTypedCpf = cpf.replace(/\D/g, '');
    const existingContributorWithCpf = useMemo(() => {
        if (!cleanTypedCpf || cleanTypedCpf.length < 11) return null;
        return contributors.find(c => {
            if (editingContributor && c.id === editingContributor.id) return false;
            const cleanC = c.cpf?.replace(/\D/g, '');
            return cleanC && cleanC === cleanTypedCpf && c.status === 'active';
        }) || null;
    }, [contributors, cleanTypedCpf, editingContributor]);

    // Filtered contributors memoized using debouncedSearch
    const filteredContributors = useMemo(() => {
        const query = debouncedSearch.toLowerCase().trim();
        const cleanQueryCpf = query.replace(/\D/g, '');
        const normalizedQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        return contributors.filter(c => {
            const hasValidName = Boolean((c.canonical_name || c.name) && String(c.canonical_name || c.name).trim());
            if (!hasValidName) return false;
            // 1. Church Filter
            if (selectedChurchFilter !== 'all') {
                const isMatch = c.church_id === selectedChurchFilter || c.is_global;
                if (!isMatch) return false;
            }

            // 2. Search query
            if (!query) return true;

            const roleVal = c.role_position || c.category;
            const nameMatch = c.canonical_name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedQuery);
            const cpfMatch = cleanQueryCpf ? c.cpf?.replace(/\D/g, '').includes(cleanQueryCpf) : false;
            const roleQueryMatch = roleVal?.toLowerCase().includes(query);
            const tradeMatch = c.trade_name?.toLowerCase().includes(query);
            const contactMatch = c.contact_person?.toLowerCase().includes(query);
            return nameMatch || cpfMatch || roleQueryMatch || tradeMatch || contactMatch;
        });
    }, [contributors, selectedChurchFilter, debouncedSearch]);

    // Paginated / slice displayed contributors for instant DOM rendering
    const displayedContributors = useMemo(() => {
        return filteredContributors.slice(0, displayLimit);
    }, [filteredContributors, displayLimit]);

    return (
        <div className={`${embedded ? 'min-h-0 flex-1' : 'h-full flex-1 min-h-[550px]'} flex flex-col animate-fade-in relative`} id="contributors-container">
            {isModalOpen && typeof document !== 'undefined' && createPortal(
                <div
                    data-register-overlay="true"
                    className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCloseModal();
                    }}
                >
                    <form
                        onSubmit={handleSave}
                        onClick={(e) => e.stopPropagation()}
                        className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-elevated w-full max-w-4xl max-h-[calc(100dvh-5rem)] md:max-h-[min(88vh,calc(100dvh-3rem))] flex flex-col overflow-hidden animate-scale-in"
                        id="contributor-form-panel"
                    >
                        {/* Form Header */}
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start sm:items-center justify-between gap-3 flex-shrink-0 bg-white dark:bg-slate-900">
                            <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                                <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                                    <UsersIcon className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate" id="contributor-form-title">
                                        {editingContributor ? 'Editar Empresa / Pessoa' : 'Nova Empresa / Pessoa'}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                        Gerenciamento de pessoas, empresas e fornecedores.
                                    </p>
                                </div>

                                {/* Switcher Pill PF / PJ */}
                                <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 gap-0.5 ml-1" id="toggle-person-type">
                                    <button
                                        type="button"
                                        onClick={() => setPersonType('PF')}
                                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                            personType === 'PF'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                        id="btn-type-pf"
                                    >
                                        <User className="w-3.5 h-3.5" />
                                        <span>Pessoa Física (PF)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPersonType('PJ')}
                                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                            personType === 'PJ'
                                                ? 'bg-amber-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                        id="btn-type-pj"
                                    >
                                        <Building2 className="w-3.5 h-3.5" />
                                        <span>Empresa / PJ</span>
                                    </button>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                                id="btn-close-contributor-form"
                                title="Fechar formulário"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Body with inputs - Scrollable */}
                        <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto custom-scrollbar w-full space-y-4">
                            <div className="space-y-4 w-full">
                            
                            {/* BLOCO 1: DADOS DE IDENTIFICAÇÃO E FOTO/LOGO INTEGRADOS */}
                            <div className="p-4 bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-4 shadow-xs">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-100 dark:border-slate-800">
                                    <Building2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                    <span>Identificação Principal e Foto / Logotipo</span>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                                    {/* Upload Foto / Logo */}
                                    <div className="lg:col-span-3 flex flex-col items-center justify-center p-3 bg-slate-50/80 dark:bg-slate-900/80 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden relative group flex items-center justify-center shadow-xs mb-2">
                                            {photoPreview ? (
                                                <img 
                                                    src={photoPreview} 
                                                    alt="Foto Contribuinte" 
                                                    className="w-full h-full object-cover" 
                                                />
                                            ) : (
                                                <div className="text-slate-400 dark:text-slate-500 flex flex-col items-center">
                                                    {personType === 'PF' ? <User className="w-8 h-8" /> : <Building2 className="w-8 h-8" />}
                                                </div>
                                            )}
                                            <div 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="absolute inset-0 bg-slate-900/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-[11px] font-semibold"
                                            >
                                                <Camera className="w-4 h-4 mb-1" />
                                                <span>Alterar</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center space-x-1">
                                            <button 
                                                type="button" 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-3 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-lg shadow-2xs cursor-pointer"
                                            >
                                                {photoPreview ? 'Trocar' : 'Carregar'}
                                            </button>
                                            {photoPreview && (
                                                <button 
                                                    type="button" 
                                                    onClick={handleRemovePhoto}
                                                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                    title="Remover foto"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            onChange={handleFileChange} 
                                            accept="image/*" 
                                            className="hidden"
                                        />
                                    </div>

                                    {/* Campos Principais */}
                                    <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                        <div className="md:col-span-2 space-y-1">
                                            <label htmlFor="contributor-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                                {personType === 'PF' ? 'Nome Completo / Canônico' : 'Razão Social Completa'} <span className="text-rose-500">*</span>
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-name" 
                                                value={fullName} 
                                                onChange={(e) => setFullName(e.target.value)} 
                                                placeholder={personType === 'PF' ? "Ex: JOÃO DA SILVA SANTOS" : "Ex: EMPRESA DISTRIBUIDORA LTDA"}
                                                className={`block w-full rounded-lg border ${isNameInvalid ? 'border-red-500 focus:ring-red-500/20' : 'border-slate-300 dark:border-slate-700 focus:ring-orange-500/20 focus:border-orange-500'} bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-semibold uppercase transition-all`}
                                                required
                                            />
                                            {isNameInvalid && (
                                                <span className="text-xs text-red-500 font-medium mt-1 block">
                                                    O nome é obrigatório.
                                                </span>
                                            )}
                                        </div>

                                        {personType === 'PJ' && (
                                            <div className="space-y-1">
                                                <label htmlFor="contributor-tradename" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                                    Nome Fantasia / Comercial
                                                </label>
                                                <input 
                                                    type="text" 
                                                    id="contributor-tradename" 
                                                    value={tradeName} 
                                                    onChange={(e) => setTradeName(e.target.value)} 
                                                    placeholder="Ex: Comercial Silva"
                                                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <label htmlFor="contributor-church" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                                Igreja / Congregação Vinculada <span className="text-rose-500">*</span>
                                            </label>
                                            <select 
                                                id="contributor-church" 
                                                value={selectedChurchId} 
                                                onChange={(e) => setSelectedChurchId(e.target.value)} 
                                                className={`block w-full rounded-lg border ${isChurchInvalid ? 'border-red-500 focus:ring-red-500/20' : 'border-slate-300 dark:border-slate-700 focus:ring-orange-500/20 focus:border-orange-500'} bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-semibold transition-all cursor-pointer`}
                                                required
                                            >
                                                {tempChurches.map((c: any) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {isChurchInvalid && (
                                                <span className="text-xs text-red-500 font-medium mt-1 block">
                                                    Selecione uma igreja válida.
                                                </span>
                                            )}
                                        </div>

                                        {/* Opção Global (visível apenas para o usuário principal / oculta para usuários secundários) */}
                                        {isPrincipalUser && (
                                            <div className="flex items-center space-x-2 pt-2">
                                                <input 
                                                    type="checkbox" 
                                                    id="contributor-global" 
                                                    checked={isGlobal} 
                                                    onChange={(e) => setIsGlobal(e.target.checked)} 
                                                    className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                />
                                                <label htmlFor="contributor-global" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                                    Visível em todas as igrejas / congregações (Global)
                                                </label>
                                            </div>
                                        )}

                                        {/* Status */}
                                        <div className="flex items-center space-x-2 pt-2">
                                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                                Status:
                                            </label>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${status === 'Ativo' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600'}`}>
                                                {status}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className={`grid grid-cols-1 ${personType === 'PJ' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3.5 pt-3 border-t border-slate-100 dark:border-slate-800`}>
                                    <div className="space-y-1">
                                        <label htmlFor="contributor-cpf" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            {personType === 'PF' ? 'CPF' : 'CNPJ'} <span className="text-rose-500">*</span>
                                        </label>
                                        <input 
                                            type="text" 
                                            id="contributor-cpf" 
                                            value={cpf} 
                                            onChange={(e) => setCpf(formatCpfCnpj(e.target.value))} 
                                            placeholder={personType === 'PF' ? "000.000.000-00" : "00.000.000/0000-00"}
                                            className={`block w-full rounded-lg border ${isCpfInvalid ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500'} text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-mono font-semibold transition-all`}
                                        />
                                        {isCpfInvalid && (
                                            <span className="text-[11px] text-red-500 font-medium mt-1 block">
                                                {personType === 'PF' ? 'CPF obrigatório com 11 dígitos.' : 'CNPJ obrigatório com 14 dígitos.'}
                                            </span>
                                        )}
                                        {existingContributorWithCpf && (
                                            <span className="text-[11px] text-amber-600 font-medium mt-1 block">
                                                ⚠️ Já existe cadastro ativo com este documento: {existingContributorWithCpf.canonical_name}
                                            </span>
                                        )}
                                    </div>

                                    {personType === 'PJ' && (
                                        <div className="space-y-1">
                                            <label htmlFor="contributor-rgie" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                                Inscrição Estadual (IE)
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-rgie" 
                                                value={rgIe} 
                                                onChange={(e) => setRgIe(e.target.value)} 
                                                placeholder="Isento ou Nº IE"
                                                className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <label htmlFor="contributor-birth" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            {personType === 'PF' ? 'Data de Nascimento' : 'Data de Fundação'}
                                        </label>
                                        <input 
                                            type="date" 
                                            id="contributor-birth" 
                                            value={birthDate} 
                                            onChange={(e) => setBirthDate(e.target.value)} 
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label htmlFor="contributor-role" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            {personType === 'PF' ? 'Vínculo / Cargo Eclesiástico' : 'Categoria / Ramo de Atuação'}
                                        </label>
                                        {personType === 'PF' ? (
                                            <InlineRoleSelector
                                                value={rolePosition}
                                                onChange={(val) => {
                                                    setRolePosition(val);
                                                    setCategory(val);
                                                }}
                                                roles={availableCustomRoles}
                                                onAddRole={handleAddRole}
                                                onRenameRole={handleRenameRole}
                                                onDeleteRole={handleDeleteRole}
                                                themeColor="amber"
                                                itemLabel="Vínculo/Cargo"
                                                placeholder="Selecione o vínculo ou cargo..."
                                            />
                                        ) : (
                                            <InlineRoleSelector
                                                value={category || 'Fornecedor'}
                                                onChange={(val) => {
                                                    setCategory(val);
                                                }}
                                                roles={availableSupplierCategories}
                                                onAddRole={handleAddSupplierCategory}
                                                onRenameRole={handleRenameSupplierCategory}
                                                onDeleteRole={handleDeleteSupplierCategory}
                                                themeColor="amber"
                                                itemLabel="Categoria"
                                                placeholder="Selecione a categoria..."
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* BLOCO 2: CONTATO & ENDEREÇO */}
                            <div className="p-4 bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3.5 shadow-xs">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-100 dark:border-slate-800">
                                    <Phone className="w-4 h-4 text-emerald-500" />
                                    <span>Contato e Endereço</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                                    {personType === 'PJ' && (
                                        <div className="space-y-1">
                                            <label htmlFor="contributor-contact" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                                Pessoa de Contato / Representante
                                            </label>
                                            <input 
                                                type="text" 
                                                id="contributor-contact" 
                                                value={contactPerson} 
                                                onChange={(e) => setContactPerson(e.target.value)} 
                                                placeholder="Ex: Carlos Oliveira (Gerente)"
                                                className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <label htmlFor="contributor-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            Telefone / WhatsApp
                                        </label>
                                        <input 
                                            type="text" 
                                            id="contributor-phone" 
                                            value={phone} 
                                            onChange={(e) => setPhone(e.target.value)} 
                                            placeholder="(00) 00000-0000"
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                        />
                                    </div>

                                    <div className={`space-y-1 ${personType === 'PF' ? 'md:col-span-2' : ''}`}>
                                        <label htmlFor="contributor-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            E-mail
                                        </label>
                                        <input 
                                            type="email" 
                                            id="contributor-email" 
                                            value={email} 
                                            onChange={(e) => setEmail(e.target.value)} 
                                            placeholder="exemplo@contato.com"
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <div className="space-y-1">
                                        <label htmlFor="contributor-cep" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            CEP
                                        </label>
                                        <input 
                                            type="text" 
                                            id="contributor-cep" 
                                            value={addressCep} 
                                            onChange={(e) => setAddressCep(e.target.value)} 
                                            placeholder="00000-000"
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                        />
                                    </div>

                                    <div className="md:col-span-2 space-y-1">
                                        <label htmlFor="contributor-street" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            Logradouro / Endereço
                                        </label>
                                        <input 
                                            type="text" 
                                            id="contributor-street" 
                                            value={addressStreet} 
                                            onChange={(e) => setAddressStreet(e.target.value)} 
                                            placeholder="Ex: Rua das Flores, Av. Central"
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label htmlFor="contributor-number" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            Número / Bairro
                                        </label>
                                        <input 
                                            type="text" 
                                            id="contributor-number" 
                                            value={addressNumber} 
                                            onChange={(e) => setAddressNumber(e.target.value)} 
                                            placeholder="Nº 123, Bairro Centro"
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
                                    <div className="md:col-span-3 space-y-1">
                                        <label htmlFor="contributor-city" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            Cidade
                                        </label>
                                        <input 
                                            type="text" 
                                            id="contributor-city" 
                                            value={addressCity} 
                                            onChange={(e) => setAddressCity(e.target.value)} 
                                            placeholder="Ex: São Paulo"
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label htmlFor="contributor-state" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            UF / Estado
                                        </label>
                                        <input 
                                            type="text" 
                                            id="contributor-state" 
                                            value={addressState} 
                                            onChange={(e) => setAddressState(e.target.value.toUpperCase())} 
                                            placeholder="SP"
                                            maxLength={2}
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-semibold uppercase focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* BLOCO 3: DADOS BANCÁRIOS & PIX (OCULTO POR PADRÃO / BOTÃO DISCRETO) */}
                            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/70 overflow-hidden shadow-xs transition-all">
                                <button
                                    type="button"
                                    onClick={() => setShowBankDetails(prev => !prev)}
                                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                        <Landmark className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition-transform" />
                                        <span>Dados Bancários e Chave Pix</span>
                                        {(pixKey || bankName || bankAccount) ? (
                                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
                                                Preenchido
                                            </span>
                                        ) : (
                                            <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                                                (opcional)
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                                        <span className="text-xs font-semibold hidden sm:inline">
                                            {showBankDetails ? 'Recolher' : 'Adicionar / Visualizar'}
                                        </span>
                                        {showBankDetails ? (
                                            <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                                        )}
                                    </div>
                                </button>

                                {showBankDetails && (
                                    <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-3.5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                            <div className="space-y-1">
                                                <label htmlFor="contributor-pix" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                                    Chave Pix Principal
                                                </label>
                                                <input 
                                                    type="text" 
                                                    id="contributor-pix" 
                                                    value={pixKey} 
                                                    onChange={(e) => setPixKey(e.target.value)} 
                                                    placeholder="E-mail, CPF/CNPJ, Telefone ou Aleatória"
                                                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label htmlFor="contributor-bankname" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                                    Instituição Bancária / Banco
                                                </label>
                                                <input 
                                                    type="text" 
                                                    id="contributor-bankname" 
                                                    value={bankName} 
                                                    onChange={(e) => setBankName(e.target.value)} 
                                                    placeholder="Ex: Itaú, Bradesco, Banco do Brasil, Nubank, Sicoob"
                                                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                            <div className="space-y-1">
                                                <label htmlFor="contributor-bankagency" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                                    Agência
                                                </label>
                                                <input 
                                                    type="text" 
                                                    id="contributor-bankagency" 
                                                    value={bankAgency} 
                                                    onChange={(e) => setBankAgency(e.target.value)} 
                                                    placeholder="0000"
                                                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label htmlFor="contributor-bankaccount" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                                    Conta Corrente / Poupança
                                                </label>
                                                <input 
                                                    type="text" 
                                                    id="contributor-bankaccount" 
                                                    value={bankAccount} 
                                                    onChange={(e) => setBankAccount(e.target.value)} 
                                                    placeholder="00000-0"
                                                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs py-2 px-3 outline-none font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* BLOCO 4: OBSERVAÇÕES INTERNAS */}
                            <div className="p-4 bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2 shadow-xs">
                                <label htmlFor="contributor-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                    Observações / Anotações Internas
                                </label>
                                <textarea 
                                    id="contributor-notes" 
                                    value={notes} 
                                    onChange={(e) => setNotes(e.target.value)} 
                                    rows={2}
                                    placeholder="Anotações sobre condições de pagamento, contratos ou histórico..."
                                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs text-xs p-2.5 outline-none font-medium resize-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                />
                            </div>

                            </div>
                        </div>

                        {/* Form Actions Footer */}
                        <div className="bg-slate-50/80 dark:bg-slate-900/70 px-5 py-3.5 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 flex-shrink-0" id="contributor-form-actions">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                                id="btn-cancel-contributor"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95"
                                id="btn-save-contributor"
                            >
                                Salvar
                            </button>
                        </div>
                    </form>
                </div>,
                document.body
            )}

                    {/* Header Area */}
                    <div className={`flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 ${embedded ? 'mb-4 pb-3' : 'mb-4 pb-4'} border-b border-slate-100 dark:border-slate-800`}>
                        {embedded ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700" title="Total de cadastros">
                                    Total: {totalContributorsCount}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40" title="Pessoas Físicas">
                                    PF: {pfContributorsCount}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40" title="Empresas / Pessoa Jurídica">
                                    PJ: {pjContributorsCount}
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shrink-0">
                                    <UsersIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                                            Empresas / Pessoas
                                        </h3>
                                        {/* Badges / Counters */}
                                        <div className="flex items-center gap-1.5">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700" title="Total de cadastros">
                                                Total: {totalContributorsCount}
                                            </span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40" title="Pessoas Físicas">
                                                PF: {pfContributorsCount}
                                            </span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40" title="Empresas / Pessoa Jurídica">
                                                PJ: {pjContributorsCount}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Gerenciamento de membros, congregados, parceiros, fornecedores, prestadores e favorecidos.
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        {/* Buttons: Importar Lote, Vincular Igrejas & + Novo Contribuinte */}
                        <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">
                            <button 
                                type="button"
                                onClick={handleRepairChurchNames}
                                disabled={isRepairingChurches}
                                title="Identifica cadastros anteriores do portal e vincula o nome da congregação correspondente"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                                id="repair-churches-btn"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 text-orange-600 dark:text-orange-400 ${isRepairingChurches ? 'animate-spin' : ''}`} />
                                <span>{isRepairingChurches ? 'Sincronizando...' : 'Vincular Igrejas'}</span>
                            </button>
                            <button 
                                type="button"
                                onClick={() => setIsImportModalOpen(true)}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                                id="import-contributors-btn"
                            >
                                <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                <span>Importar Lote</span>
                            </button>
                            <button 
                                type="button"
                                onClick={handleNewContributorClick}
                                className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95"
                                id="new-contributor-btn"
                            >
                                <PlusCircleIcon className="w-3.5 h-3.5" />
                                <span>Nova Empresa / Pessoa</span>
                            </button>
                        </div>
                    </div>

            {/* INLINE BATCH IMPORT PANEL */}
            {isImportModalOpen && (
                <div className="flex-shrink-0 bg-slate-50/80 dark:bg-slate-900/70 p-4 md:p-5 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-4 animate-fade-in mb-5 w-full" id="import-form-panel">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-200/80 dark:border-orange-900/50 rounded-xl flex items-center justify-center shrink-0">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                                    Importar Empresas / Pessoas em Lote
                                </h4>
                                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                                    Extraia dados de arquivos OFX, CSV, TXT ou Planilhas Excel
                                </span>
                            </div>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => {
                                setIsImportModalOpen(false);
                                setImportFile(null);
                                setParsedContributors([]);
                            }} 
                            className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            title="Fechar importação"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="w-full">
                        {!importFile ? (
                            /* Drag and Drop / Select File Zone */
                            <div className="flex flex-col items-center justify-center">
                                <div 
                                    onClick={() => importFileInputRef.current?.click()}
                                    className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-500/70 bg-white dark:bg-slate-900/50 rounded-xl p-7 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group shadow-xs"
                                >
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 text-slate-400 dark:text-slate-500 group-hover:text-orange-600 transition-colors mb-3">
                                        <FileUp className="w-6 h-6" />
                                    </div>
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                                        Carregar arquivo do extrato ou lista
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-3">
                                        Selecione um extrato <span className="font-semibold text-slate-700 dark:text-slate-300">OFX</span>, arquivo <span className="font-semibold text-slate-700 dark:text-slate-300">CSV/TXT</span> ou planilha <span className="font-semibold text-slate-700 dark:text-slate-300">Excel</span> contendo os nomes, razões sociais, CPFs ou CNPJs.
                                    </p>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700">
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
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-3" />
                                <h5 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                                    Analisando documento localmente...
                                </h5>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Mapeando registros, normalizando nomes e detectando CPFs.
                                </p>
                            </div>
                        ) : (
                            /* Review & Edit State */
                            <div className="space-y-4">
                                {/* Default Church selection */}
                                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            Igreja de Destino
                                        </label>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            Selecione a igreja à qual estas empresas ou pessoas pertencem.
                                        </p>
                                    </div>
                                    <select
                                        value={defaultImportChurchId}
                                        onChange={(e) => setDefaultImportChurchId(e.target.value)}
                                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 text-xs font-semibold py-2 px-3 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer min-w-[200px] shadow-xs"
                                    >
                                        {tempChurches.filter(c => c.id !== 'church-1').map((church) => (
                                            <option key={church.id} value={church.id}>
                                                {church.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Summary Stats */}
                                <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 pb-2 tabular-nums">
                                    <span>Registros Encontrados: {parsedContributors.length}</span>
                                    <div className="flex space-x-3">
                                        <span className="text-emerald-600 dark:text-emerald-400">
                                            Novos: {parsedContributors.filter(c => !checkDuplicate(c.cpf, c.name, defaultImportChurchId)).length}
                                        </span>
                                        <span className="text-amber-600 dark:text-amber-400">
                                            Duplicados (pulados): {parsedContributors.filter(c => checkDuplicate(c.cpf, c.name, defaultImportChurchId)).length}
                                        </span>
                                    </div>
                                </div>

                                {/* Contributors Editable Table */}
                                <div
                                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
                                    className="overflow-x-auto max-h-[35vh] border border-slate-200/90 dark:border-slate-800 rounded-xl custom-scrollbar bg-white dark:bg-slate-900"
                                >
                                    <table className="min-w-full divide-y divide-slate-200/80 dark:divide-slate-800 text-xs">
                                        <thead className="bg-slate-50/95 dark:bg-slate-800/90 sticky top-0 z-10 border-b border-slate-200/90 dark:border-slate-800">
                                            <tr>
                                                <th className="px-4 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                                                    Nome / Razão Social
                                                </th>
                                                <th className="px-4 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                                                    CPF / CNPJ Identificado
                                                </th>
                                                <th className="px-4 py-2.5 text-right font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] w-[115px]">
                                                    Situação
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 bg-white dark:bg-slate-900">
                                            {parsedContributors.map((c, idx) => {
                                                const isDup = checkDuplicate(c.cpf, c.name, defaultImportChurchId);
                                                return (
                                                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
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
                                                                className={`w-full bg-transparent p-1 border-b rounded-sm transition-colors text-xs font-semibold uppercase ${
                                                                    isDup 
                                                                        ? 'text-slate-400 border-transparent cursor-not-allowed' 
                                                                        : 'text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 focus:border-orange-500 outline-none'
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
                                                                className={`w-full bg-transparent p-1 border-b rounded-sm transition-colors text-xs tabular-nums font-medium ${
                                                                    isDup 
                                                                        ? 'text-slate-400 border-transparent cursor-not-allowed' 
                                                                        : 'text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 focus:border-orange-500 outline-none'
                                                                }`}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-2 text-right">
                                                            {isDup ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50">
                                                                    <AlertTriangle className="w-3 h-3" />
                                                                    Duplicado
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50">
                                                                    <Check className="w-3 h-3" />
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
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                    * Linhas marcadas como "Duplicado" possuem CPF/CNPJ ou Nome idênticos a cadastros já ativos nesta igreja e serão pulados automaticamente para evitar duplicidade.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center pt-3 border-t border-slate-200/80 dark:border-slate-800">
                        <div>
                            {isImporting && (
                                <div className="text-left">
                                    <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 tabular-nums">
                                        Importando {importProgress.current} de {importProgress.total}...
                                    </p>
                                    <div className="w-36 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                        <div 
                                            className="bg-orange-600 h-full rounded-full transition-all duration-300" 
                                            style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2.5">
                            <button 
                                type="button" 
                                onClick={() => {
                                    setIsImportModalOpen(false);
                                    setImportFile(null);
                                    setParsedContributors([]);
                                }} 
                                disabled={isImporting}
                                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {importFile ? 'Voltar' : 'Fechar'}
                            </button>
                            {importFile && !isLoadingImport && (
                                <button 
                                    type="button" 
                                    onClick={handleExecuteImport}
                                    disabled={isImporting || parsedContributors.filter(c => !checkDuplicate(c.cpf, c.name, defaultImportChurchId)).length === 0}
                                    className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {isImporting ? 'Cadastrando...' : 'Confirmar Cadastro'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Visual Search input & Church Filter Selector below header */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4 flex-shrink-0">
                <div className="relative flex-1">
                    <SearchIcon className="w-4 h-4 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nome, razão social, vínculo/cargo, CPF ou CNPJ..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        className="pl-9 pr-3 py-2 block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all shadow-xs text-xs font-medium outline-none" 
                        id="contributors-search"
                    />
                </div>

                {/* Church Selector Filter */}
                <div className="sm:w-64 flex-shrink-0">
                    <select
                        value={selectedChurchFilter}
                        onChange={(e) => setSelectedChurchFilter(e.target.value)}
                        className="px-3 py-2 block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all shadow-xs text-xs font-semibold outline-none cursor-pointer"
                        id="contributors-church-filter"
                    >
                        <option value="all">⛪ Todas as Igrejas ({totalContributorsCount})</option>
                        {churches.map((ch: any) => {
                            const churchCount = contributors.filter(c => c.church_id === ch.id || c.is_global).length;
                            return (
                                <option key={ch.id} value={ch.id}>
                                    {ch.name} ({churchCount})
                                </option>
                            );
                        })}
                    </select>
                </div>
            </div>

            {/* Content list or empty states */}
            {isLoadingContributors ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 animate-pulse text-center">
                    <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-3" />
                    <p className="text-slate-500 text-xs font-semibold">
                        Carregando empresas / pessoas...
                    </p>
                </div>
            ) : filteredContributors.length === 0 ? (
                <div className={`flex-1 flex flex-col items-center justify-center p-6 sm:p-8 bg-slate-50/70 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl ${embedded ? 'min-h-[200px]' : 'min-h-[250px]'} animate-fade-in-up`}>
                    <div className="p-3.5 bg-slate-100/80 dark:bg-slate-900 rounded-xl mb-3">
                        <UsersIcon className="w-7 h-7 text-slate-400 dark:text-slate-600" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                        Nenhum registro encontrado.
                    </h4>
                    <p className="max-w-md text-center text-slate-500 dark:text-slate-400 text-xs leading-relaxed" id="contributors-message">
                        {search ? "Nenhum resultado corresponde à sua busca." : "Cadastre a primeira empresa ou pessoa utilizando o botão no topo direito."}
                    </p>
                </div>
            ) : (
                <div
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
                    className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar border border-slate-200/90 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900"
                    id="contributors-list-flow"
                >
                    <table className="min-w-full divide-y divide-slate-200/80 dark:divide-slate-800">
                        <thead className="bg-slate-50/90 dark:bg-slate-800/80 sticky top-0 z-10 border-b border-slate-200/90 dark:border-slate-800">
                            <tr>
                                <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Empresa / Pessoa
                                </th>
                                <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Igreja Vinculada
                                </th>
                                <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Documento / Contato
                                </th>
                                <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 bg-white dark:bg-slate-900 font-sans">
                            {displayedContributors.map((c) => {
                                const church = churches.find((ch: any) => ch.id === c.church_id || (c.congregation && ch.name && ch.name.trim().toLowerCase() === c.congregation.trim().toLowerCase()));
                                const isPJ = c.person_type === 'PJ' || (c.cpf && c.cpf.replace(/\D/g, '').length === 14);
                                return (
                                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors animate-fade-in">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center space-x-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 select-none shadow-xs overflow-hidden ${
                                                    isPJ 
                                                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/40' 
                                                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/40'
                                                }`}>
                                                    {(c.photo_url || c.photo || c.photoUrl || c.avatarUrl) ? (
                                                        <img 
                                                            src={c.photo_url || c.photo || c.photoUrl || c.avatarUrl} 
                                                            alt={c.canonical_name} 
                                                            className="w-full h-full object-cover" 
                                                            loading="lazy"
                                                            decoding="async"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    ) : isPJ ? (
                                                        <Building2 className="w-4 h-4" />
                                                    ) : (
                                                        <User className="w-4 h-4" />
                                                    )}
                                                </div>
                                                <div className="truncate max-w-[220px]">
                                                    <div className="flex items-center space-x-1.5 mb-0.5">
                                                        <span className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                                                            isPJ ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/70 dark:border-amber-900/40' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/70 dark:border-blue-900/40'
                                                        }`}>
                                                            {isPJ ? 'PJ / Empresa' : 'PF'}
                                                        </span>
                                                        {c.category && (
                                                            <span className="inline-block px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 truncate max-w-[100px]">
                                                                {c.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
                                                        {c.canonical_name}
                                                    </h5>
                                                    {c.trade_name && (
                                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block truncate">
                                                            Fantasia: {c.trade_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                    {church ? church.name : (c.congregation || 'Igreja não identificada')}
                                                </span>
                                                {c.is_global && (
                                                    <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-900/50">
                                                        <Globe className="w-3 h-3" />
                                                        Todas as Igrejas (Global)
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3">
                                            <div className="space-y-0.5 max-w-[220px] truncate">
                                                {c.cpf && (
                                                    <div className="text-[11px] tabular-nums font-medium text-slate-700 dark:text-slate-300 flex items-center">
                                                        <span className="text-[10px] font-semibold text-slate-400 mr-1 uppercase">
                                                            {c.cpf.replace(/\D/g, '').length === 14 ? 'CNPJ:' : 'CPF:'}
                                                        </span>
                                                        {formatCpfCnpj(c.cpf)}
                                                    </div>
                                                )}
                                                {c.contact_person && (
                                                    <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center truncate">
                                                        <span className="text-[10px] font-semibold text-slate-400 mr-1 uppercase">Contato:</span>
                                                        <span className="truncate">{c.contact_person}</span>
                                                    </div>
                                                )}
                                                {c.phone && (
                                                    <div className="text-[11px] tabular-nums font-medium text-slate-500 dark:text-slate-400 flex items-center">
                                                        <span className="text-[10px] font-semibold text-slate-400 mr-1 uppercase">Tel:</span>
                                                        {c.phone}
                                                    </div>
                                                )}
                                                {c.email && (
                                                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center truncate">
                                                        <span className="text-[10px] font-semibold text-slate-400 mr-1 uppercase">Email:</span>
                                                        <span className="truncate">{c.email}</span>
                                                    </div>
                                                )}
                                                {!c.cpf && !c.phone && !c.email && !c.contact_person && (
                                                    <span className="text-xs text-slate-400">-</span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                                c.status === 'active' 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40' 
                                                    : 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/40'
                                            }`}>
                                                {c.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end space-x-1.5">
                                                <button 
                                                    onClick={() => handleEditClick(c)}
                                                    className="px-2.5 py-1 rounded-lg border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 hover:text-orange-600 dark:text-slate-300 dark:hover:text-orange-400 text-[11px] font-semibold transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
                                                    title="Editar dados"
                                                >
                                                    <Edit2 className="w-3 h-3" />
                                                    <span>Editar</span>
                                                </button>

                                                {c.status === 'active' ? (
                                                    <button 
                                                        onClick={() => handleDeleteContributor(c.id, c.canonical_name)}
                                                        className="px-2.5 py-1 rounded-lg border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-950/30 dark:text-slate-300 dark:hover:text-rose-400 text-slate-600 text-[11px] font-semibold transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
                                                        title="Inativar contribuinte"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        <span>Inativar</span>
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => {
                                                            authFetch(`/api/v1/contributors/${c.id}`, {
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
                                                        className="px-2.5 py-1 rounded-lg border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 dark:hover:bg-emerald-950/30 dark:text-slate-300 dark:hover:text-emerald-400 text-slate-600 text-[11px] font-semibold transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
                                                        title="Ativar contribuinte"
                                                    >
                                                        <Loader2 className="w-3 h-3" />
                                                        <span>Ativar</span>
                                                    </button>
                                                )}

                                                <button 
                                                    onClick={() => handleDeletePermanent(c.id, c.canonical_name)}
                                                    className="px-2.5 py-1 rounded-lg border border-rose-200/80 dark:border-rose-900/40 bg-white dark:bg-slate-800 hover:bg-rose-600 hover:text-white hover:border-rose-600 dark:hover:bg-rose-600 dark:text-rose-400 text-rose-600 text-[11px] font-semibold transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
                                                    title="Excluir cadastro permanentemente"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    <span>Excluir</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {filteredContributors.length > displayLimit && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                                Exibindo <strong className="font-semibold text-slate-800 dark:text-slate-200">{displayedContributors.length}</strong> de <strong className="font-semibold text-slate-800 dark:text-slate-200">{filteredContributors.length}</strong> cadastros
                            </span>
                            <button
                                onClick={() => setDisplayLimit(prev => prev + 60)}
                                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                                Carregar mais 60 registros...
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
