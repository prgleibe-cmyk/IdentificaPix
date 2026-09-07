/**
 * Formatting and Mask utilities for Portal do Contribuinte (Mock UX)
 */

export const formatCpf = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : '';
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const generateMockReferenceNumber = (): string => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSeq = Math.floor(100000 + Math.random() * 900000);
    return `IG-${dateStr}-${randomSeq}`;
};

export const formatCurrencyBrl = (amount: number): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(amount || 0);
};

export const validateCpfVisual = (cpf: string): boolean => {
    const clean = cpf.replace(/\D/g, '');
    return clean.length === 11;
};

export const validatePhoneVisual = (phone: string): boolean => {
    const clean = phone.replace(/\D/g, '');
    return clean.length >= 10 && clean.length <= 11;
};

export const validateEmailVisual = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const formatDateToDmy = (value?: string | null): string => {
    if (!value) return '';
    const clean = String(value).trim();
    const dmy = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmy) return clean;
    const ymd = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) {
        return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
    }
    return clean;
};

export const formatDateToYmd = (value?: string | null): string => {
    if (!value) return '';
    const clean = String(value).trim();
    const dmy = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmy) {
        return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    }
    const ymd = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) {
        return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
    }
    return '';
};
