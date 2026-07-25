export interface PortalChurch {
    id?: string;
    name: string;
    slug: string;
    city?: string;
    state?: string;
    address?: string;
    pastor?: string;
    logoUrl?: string;
    description?: string;
}

export type PortalRoute = 
    | 'home'
    | 'church'
    | 'identify'
    | 'register'
    | 'reports'
    | 'pledges'
    | 'coming_soon'
    | 'not_found';

export interface ContributionPledge {
    id: string;
    title: string;
    category: string;
    type: 'carne' | 'proposito' | 'recorrente';
    amountPerInstallment: number;
    totalInstallments: number; // 0 for infinite/recurring
    dueDay: number; // 1-31
    frequency: 'mensal' | 'quinzenal' | 'semanal' | 'unica';
    startDate: string;
    reminderDaysBefore: number; // 0 = on due date, 1, 3, 5, 7
    reminderChannel: 'whatsapp' | 'email' | 'sms' | 'todos';
    status: 'active' | 'completed' | 'paused' | 'cancelled';
    paidInstallments: number;
    created_at: string;
    church_id?: string;
    contributor_id?: string;
}

export interface PortalRouteParams {
    churchSlug?: string;
    feature?: string;
}

export type IdentificationType = 'cpf' | 'phone' | 'email';

export interface ContributorMockProfile {
    id: string;
    name: string;
    cpf: string;
    phone: string;
    email: string;
    city: string;
    state: string;
    congregation: string;
    avatarUrl?: string;
    isExisting: boolean;
}

export interface ContributionItemMock {
    id: string;
    label: string;
    description: string;
    selected: boolean;
    amount: number;
    bank_id?: string;
}

export interface ContributionWizardState {
    step: number; // 1: Identify, 2: Contributor/Register, 3: Select Items, 4: Summary, 5: Payment, 6: Success
    identificationType: IdentificationType;
    identificationValue: string;
    mockSearchFound: boolean; // Simulator toggle
    contributor: ContributorMockProfile;
    contributionItems: ContributionItemMock[];
    referenceNumber: string;
    createdAt: string;
    contributionRequestId?: string;
    contributionRequestStatus?: 'pending' | 'confirmed' | string;
}

export interface ChurchPixKeyPublic {
    id: string;
    bank_id?: string;
    church_id?: string;
    pix_type: 'cpf' | 'cnpj' | 'phone' | 'email' | 'random' | string;
    pix_key: string;
    holder_name?: string | null;
    description?: string | null;
    bank_name?: string | null;
    accepted_contribution_types?: string[] | null;
    is_active: boolean;
    created_at?: string;
}

