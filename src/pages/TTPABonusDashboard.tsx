import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Badge } from '../components/Badge';
import {
  Gift,
  Sparkles,
  TrendingUp,
  Award,
  Calendar,
  Filter,
  DollarSign,
  Users,
  CheckCircle2,
  RotateCw,
  Calculator,
  Search,
  ExternalLink,
  Flame,
  Zap,
  Plus,
  Save,
  Trash2,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
} from 'lucide-react';

interface Representative {
  id: string;
  Representative: string;
  Type: string;
  wfe?: boolean;
}

interface MonthOption {
  monthKey: string; // e.g. "2026-08"
  label: string; // e.g. "August 2026"
  year: number;
  monthNumber: number;
}

interface StudentRecord {
  id: string;
  name: string;
  email: string;
  date: string;
  day: number;
  weekNumber: number; // 1 to 5
  representativeId?: string;
  contactId?: string;
  representativeName: string;
  isWFE: boolean;
  isUnassigned: boolean;
  crmUrl?: string;
  program?: string;
  stage?: string;
  source?: string;
}

interface WfeMembershipPeriod {
  id: string;
  representative_id: string;
  start_date: string;
  end_date: string | null;
}

const BONUS_MIN_MONTH = '2026-08';

// Representantes excluídos conforme solicitação
const EXCLUDED_REPRESENTATIVES = [
  'Iasmin Canhette',
  'Jose Vega',
  'Rafaela Porto',
  'Rodrigo Nunes',
];

// Paleta de cores moderna por semana
const WEEK_PALETTE = [
  { color: '#2563EB', lightBg: 'rgba(37, 99, 235, 0.08)', border: 'rgba(37, 99, 235, 0.3)', badgeBg: '#EFF6FF', badgeText: '#1E40AF' }, // W1: Blue
  { color: '#8B5CF6', lightBg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.3)', badgeBg: '#F5F3FF', badgeText: '#5B21B6' }, // W2: Purple
  { color: '#F59E0B', lightBg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)', badgeBg: '#FEF3C7', badgeText: '#92400E' }, // W3: Amber
  { color: '#10B981', lightBg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)', badgeBg: '#ECFDF5', badgeText: '#065F46' }, // W4: Emerald
  { color: '#06B6D4', lightBg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.3)', badgeBg: '#ECFEFF', badgeText: '#155E75' },  // W5: Cyan
];

// ── Funções de Cálculo TTPA ──
const getTTPAWeekRate = (students: number): { rate: number; label: string } => {
  if (students >= 4) return { rate: 50, label: '$50 / student' };
  if (students === 3) return { rate: 40, label: '$40 / student' };
  if (students === 2) return { rate: 30, label: '$30 / student' };
  if (students === 1) return { rate: 10, label: '$10 / student' };
  return { rate: 0, label: 'No bonus' };
};

const getTTPAMonthlyBonus = (totalStudents: number): { bonus: number; tierLabel: string } => {
  if (totalStudents >= 10) {
    return { bonus: 100, tierLabel: 'Tier 10+ students (+$100)' };
  }
  if (totalStudents >= 8) {
    return { bonus: 80, tierLabel: 'Tier 8-9 students (+$80)' };
  }
  if (totalStudents >= 6) {
    return { bonus: 60, tierLabel: 'Tier 6-7 students (+$60)' };
  }
  if (totalStudents >= 4) {
    return { bonus: 40, tierLabel: 'Tier 4-5 students (+$40)' };
  }
  return { bonus: 0, tierLabel: 'No monthly bonus' };
};

// ── Funções de Cálculo WFE ──
const getWFEWeekRate = (students: number): { rate: number; label: string; additionalBonus: number } => {
  if (students >= 9) return { rate: 15.0, label: '$15.00 / student', additionalBonus: 100 };
  if (students >= 7) return { rate: 10.0, label: '$10.00 / student', additionalBonus: 0 };
  if (students >= 5) return { rate: 7.5, label: '$7.50 / student', additionalBonus: 0 };
  if (students >= 3) return { rate: 5.0, label: '$5.00 / student', additionalBonus: 0 };
  return { rate: 0, label: 'No bonus', additionalBonus: 0 };
};

const getWeekRangeLabel = (year: number, month: number, weekIndex: number): string => {
  const startDay = (weekIndex - 1) * 7 + 1;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const endDay = Math.min(weekIndex * 7, lastDayOfMonth);
  
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(month)}/${pad(startDay)} - ${pad(month)}/${pad(endDay)}`;
};

export const TTPABonusDashboard: React.FC = () => {
  // Obter sessão do usuário para controle RBAC / Admin
  const [userSession] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('ttpa_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const isAdmin = userSession?.user?.role === 'admin';
  const userRepId = userSession?.user?.representative_id;

  // ── States dos Filtros ──
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [brlRate, setBrlRate] = useState<number>(5.20);
  const [isRateLive, setIsRateLive] = useState<boolean>(false);
  const [isLoadingRate, setIsLoadingRate] = useState<boolean>(false);
  const [rateSource, setRateSource] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [wfePeriods, setWfePeriods] = useState<WfeMembershipPeriod[]>([]);
  const [isWfeSettingsOpen, setIsWfeSettingsOpen] = useState(false);
  const [isSavingWfePeriod, setIsSavingWfePeriod] = useState(false);
  const [wfePeriodMessage, setWfePeriodMessage] = useState<string | null>(null);
  const [newWfePeriod, setNewWfePeriod] = useState({
    representativeId: '',
    startDate: `${BONUS_MIN_MONTH}-01`,
    endDate: '',
  });
  const [fixStudent, setFixStudent] = useState<StudentRecord | null>(null);
  const [fixMode, setFixMode] = useState<'wfe' | 'representative'>('representative');
  const [fixRepresentativeId, setFixRepresentativeId] = useState('');
  const [isSavingFix, setIsSavingFix] = useState(false);
  const [fixMessage, setFixMessage] = useState<string | null>(null);

  // ── States dos Dados ──
  const [studentsData, setStudentsData] = useState<StudentRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // ── Calculadora State ──
  const [calcMode, setCalcMode] = useState<'ttpa' | 'wfe'>('ttpa');
  const [calcWeeks, setCalcWeeks] = useState<number[]>([2, 3, 1, 2]);
  const [calcWfeStudents, setCalcWfeStudents] = useState<number>(9);

  // Formatação monetária
  const formatUSD = (val: number) =>
    `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatBRL = (usdVal: number) =>
    `R$ ${(usdVal * brlRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    loadInitialFilters();
    fetchLiveExchangeRate();
  }, []);

  const fetchLiveExchangeRate = async () => {
    setIsLoadingRate(true);
    try {
      const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
      if (res.ok) {
        const data = await res.json();
        if (data?.USDBRL?.bid) {
          const rate = parseFloat(data.USDBRL.bid);
          if (!isNaN(rate) && rate > 0) {
            setBrlRate(rate);
            setIsRateLive(true);
            setRateSource('USD/BRL');
            setIsLoadingRate(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Tentando endpoint Olinda BCB...', err);
    }

    try {
      const today = new Date();
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const dateFormatted = `${pad(today.getMonth() + 1)}-${pad(today.getDate())}-${today.getFullYear()}`;
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dateFormatted}'&$top=1&$format=json`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data?.value?.length > 0 && data.value[0].cotacaoVenda) {
          const rate = parseFloat(data.value[0].cotacaoVenda);
          if (!isNaN(rate) && rate > 0) {
            setBrlRate(rate);
            setIsRateLive(true);
            setRateSource('BCB PTAX');
            setIsLoadingRate(false);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao consultar BCB PTAX:', e);
    }
    setIsLoadingRate(false);
  };

  useEffect(() => {
    if (selectedMonth) {
      loadStudentsForMonth();
    }
  }, [selectedMonth]);

  const loadInitialFilters = async () => {
    try {
      const { data: repsData } = await supabase
        .from('dRepresentatives')
        .select('id, Representative, Type, wfe')
        .eq('Type', 'TTPA')
        .order('Representative', { ascending: true });

      if (repsData) {
        // Filtrar representantes excluídos
        const filteredReps = repsData.filter(
          (r: any) => !EXCLUDED_REPRESENTATIVES.includes(r.Representative)
        );
        setRepresentatives(filteredReps);
        setNewWfePeriod((prev) => ({
          ...prev,
          representativeId: prev.representativeId || filteredReps[0]?.id || '',
        }));

        // Se o usuário não for admin e tiver representative_id vinculado, trava nele
        if (!isAdmin && userRepId) {
          const userRep = filteredReps.find((r) => r.id === userRepId);
          if (userRep) {
            setSelectedRep(userRep.Representative);
          } else if (filteredReps.length > 0) {
            setSelectedRep(filteredReps[0].Representative);
          }
        } else if (filteredReps.length > 0) {
          // Selecionar o primeiro representante por padrão (sem opção 'All')
          setSelectedRep((prev) => (prev && filteredReps.some((r) => r.Representative === prev) ? prev : filteredReps[0].Representative));
        }
      }

      const { data: datesData } = await supabase
        .from('dDates')
        .select('"Year Month", "Month Name", "Year", "Month Number"')
        .order('"Year Month"', { ascending: false });

      if (datesData && datesData.length > 0) {
        const uniqueMonthsMap = new Map<string, MonthOption>();
        datesData.forEach((d: any) => {
          const key = d['Year Month'];
          if (key && !uniqueMonthsMap.has(key)) {
            uniqueMonthsMap.set(key, {
              monthKey: key,
              label: `${d['Month Name']} ${d['Year']}`,
              year: d['Year'],
              monthNumber: d['Month Number'],
            });
          }
        });
        const monthsList = Array.from(uniqueMonthsMap.values())
          .filter((month) => month.monthKey >= BONUS_MIN_MONTH);
        setAvailableMonths(monthsList);

        if (monthsList.some((m) => m.monthKey === '2026-08')) {
          setSelectedMonth('2026-08');
        } else if (monthsList.length > 0) {
          setSelectedMonth(monthsList[0].monthKey);
        }
      }
    } catch (err) {
      console.error('Error loading bonus filters:', err);
    }

    await loadWfePeriods();
  };

  const loadWfePeriods = async () => {
    const { data, error } = await supabase
      .from('representative_wfe_periods')
      .select('id, representative_id, start_date, end_date')
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error loading WFE membership periods:', error);
      setWfePeriodMessage('Unable to load WFE membership settings. Confirm that the database migration has been applied.');
      return;
    }
    setWfePeriods(data || []);
  };

  const saveWfePeriod = async () => {
    if (!newWfePeriod.representativeId || !newWfePeriod.startDate) {
      setWfePeriodMessage('Select a representative and a start date.');
      return;
    }
    if (newWfePeriod.endDate && newWfePeriod.endDate < newWfePeriod.startDate) {
      setWfePeriodMessage('The end date cannot be before the start date.');
      return;
    }

    setIsSavingWfePeriod(true);
    setWfePeriodMessage(null);
    const { error } = await supabase.from('representative_wfe_periods').insert({
      representative_id: newWfePeriod.representativeId,
      start_date: newWfePeriod.startDate,
      end_date: newWfePeriod.endDate || null,
    });
    setIsSavingWfePeriod(false);

    if (error) {
      setWfePeriodMessage(error.code === '23P01'
        ? 'This period overlaps an existing WFE period for the representative.'
        : `Unable to save this WFE period: ${error.message}`);
      return;
    }

    setWfePeriodMessage('WFE period saved.');
    setNewWfePeriod((prev) => ({ ...prev, startDate: '', endDate: '' }));
    await loadWfePeriods();
  };

  const deleteWfePeriod = async (periodId: string) => {
    const { error } = await supabase.from('representative_wfe_periods').delete().eq('id', periodId);
    if (error) {
      setWfePeriodMessage(`Unable to remove this WFE period: ${error.message}`);
      return;
    }
    setWfePeriodMessage('WFE period removed.');
    await loadWfePeriods();
  };

  const loadStudentsForMonth = async () => {
    try {
      const [yearStr, monthStr] = selectedMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const startDate = `${yearStr}-${monthStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${yearStr}-${monthStr}-${lastDay < 10 ? `0${lastDay}` : lastDay}`;

      // 1. Buscar estudantes
      const { data: students, error: sErr } = await supabase
        .from('fStudents')
        .select(`
          id,
          Name,
          Email,
          Date,
          Stage,
          Source,
          "Program Enrollment",
          "Contact ID",
          representative_id,
          dRepresentatives:representative_id (
            id,
            Representative,
            Type,
            wfe
          )
        `)
        .gte('Date', startDate)
        .lte('Date', endDate)
        .order('Date', { ascending: true });

      if (sErr) {
        console.error('Error fetching students:', sErr);
      }

      // 2. Buscar contatos para resolver WFE e crm_url por email
      const studentEmails = (students || [])
        .map((s: any) => s.Email?.trim())
        .filter((e: any) => Boolean(e));

      const contactsMap = new Map<string, any>();
      if (studentEmails.length > 0) {
        const { data: contacts, error: cErr } = await supabase
          .from('dContacts_crm')
          .select('Email, "Contact ID", crm_url, WFE, representative_id')
          .in('Email', studentEmails);

        if (contacts) {
          contacts.forEach((c: any) => {
            if (c.Email) {
              contactsMap.set(c.Email.trim().toLowerCase(), c);
            }
          });
        }
      }

      // Admin-only live overrides. This makes a newly saved representative_fix
      // visible immediately, before the next ETL refresh persists it in dContacts_crm.
      const fixesMap = new Map<string, any>();
      if (isAdmin && studentEmails.length > 0) {
        const { data: fixes, error: fixesError } = await supabase
          .from('representative_fix')
          .select('email, representative_id, wfe, dRepresentatives:representative_id(Representative)')
          .in('email', studentEmails);

        if (fixesError) {
          console.error('Error fetching representative fixes:', fixesError);
        } else {
          fixes?.forEach((fix: any) => {
            if (fix.email) fixesMap.set(fix.email.trim().toLowerCase(), fix);
          });
        }
      }

      if (students) {
        const formatted: StudentRecord[] = students
          .filter((s: any) => {
            const repName = s.dRepresentatives?.Representative;
            return !EXCLUDED_REPRESENTATIVES.includes(repName);
          })
          .map((s: any) => {
            const sDate = s.Date ? new Date(s.Date + 'T12:00:00') : new Date();
            const day = sDate.getDate();
            const weekNumber = Math.min(5, Math.floor((day - 1) / 7) + 1);

            const emailKey = (s.Email || '').trim().toLowerCase();
            const contactInfo = contactsMap.get(emailKey);
            const representativeFix = fixesMap.get(emailKey);

            let repName = '';
            let isWFE = false;
            let isUnassigned = false;

            // A correction made by an admin has priority and is shown immediately.
            if (representativeFix?.wfe === true) {
              repName = 'WFE';
              isWFE = true;
              isUnassigned = false;
            } else if (representativeFix?.representative_id) {
              repName = representativeFix.dRepresentatives?.Representative || 'Assigned representative';
              isWFE = false;
              isUnassigned = false;
            // Regra: Se a coluna dContacts_crm.WFE = true, o Representative é WFE
            } else if (contactInfo?.WFE === true) {
              repName = 'WFE';
              isWFE = true;
              isUnassigned = false;
            } else if (s.dRepresentatives?.Representative) {
              // Se tem representante associado, permanece o nome do representante (ex: Suzana Santos)
              repName = s.dRepresentatives.Representative;
              isWFE = false;
              isUnassigned = false;
            } else {
              // Caso contrário, sem representante e sem WFE = Unassigned
              repName = 'Unassigned';
              isWFE = false;
              isUnassigned = true;
            }

            const crmUrl =
              contactInfo?.crm_url ||
              (contactInfo?.['Contact ID']
                ? `https://crm.myunifyai.com/contact/edit/${contactInfo['Contact ID']}`
                : undefined);

            return {
              id: s.id,
              name: s.Name || s.Email?.split('@')[0] || 'Unnamed Student',
              email: s.Email || '',
              date: s.Date,
              day,
              weekNumber,
              representativeId: s.representative_id,
              contactId: s['Contact ID'],
              representativeName: repName,
              isWFE,
              isUnassigned,
              crmUrl,
              program: s['Program Enrollment'] || 'TTPA Track',
              stage: s.Stage || 'Enrolled',
              source: s.Source || 'Direct',
            };
          });

        setStudentsData(formatted);
      }
    } catch (err) {
      console.error('Error fetching students for month:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadStudentsForMonth();
  };

  const openRepresentativeFix = (student: StudentRecord) => {
    setFixStudent(student);
    setFixMode(student.isWFE ? 'wfe' : 'representative');
    setFixRepresentativeId(student.representativeId || '');
    setFixMessage(null);
  };

  const saveRepresentativeFix = async () => {
    if (!isAdmin || !fixStudent) return;
    if (fixMode === 'representative' && !fixRepresentativeId) {
      setFixMessage('Select a representative or mark this student as WFE.');
      return;
    }

    setIsSavingFix(true);
    setFixMessage(null);
    const { error } = await supabase.from('representative_fix').insert({
      contact_id: fixStudent.contactId || null,
      email: fixStudent.email.trim().toLowerCase(),
      representative_id: fixMode === 'representative' ? fixRepresentativeId : null,
      wfe: fixMode === 'wfe',
      updated_by: userSession?.user?.id || null,
    });
    setIsSavingFix(false);

    if (error) {
      setFixMessage(`Unable to save this correction: ${error.message}`);
      return;
    }

    setIsRefreshing(true);
    setFixStudent(null);
    await loadStudentsForMonth();
  };

  // Representante selecionado
  const currentRepObj = useMemo(() => {
    return representatives.find((r) => r.Representative === selectedRep) || representatives[0] || null;
  }, [selectedRep, representatives]);

  const isRepresentativeWfeDuring = (representativeId: string, startDate: string, endDate: string) =>
    wfePeriods.some((period) =>
      period.representative_id === representativeId &&
      period.start_date <= endDate &&
      (!period.end_date || period.end_date >= startDate)
    );

  const getWeekDateRange = (weekNumber: number) => {
    const lastDay = new Date(currentYear, currentMonthNum, 0).getDate();
    const startDay = (weekNumber - 1) * 7 + 1;
    const endDay = Math.min(weekNumber * 7, lastDay);
    const formatDate = (day: number) => `${selectedMonth}-${String(day).padStart(2, '0')}`;
    return { startDate: formatDate(startDay), endDate: formatDate(endDay) };
  };

  const wfeEligibleWeeksFor = (representativeId?: string) =>
    Array.from({ length: monthWeeksCount }, (_, index) => index + 1).filter((weekNumber) => {
      if (!representativeId) return false;
      const range = getWeekDateRange(weekNumber);
      return isRepresentativeWfeDuring(representativeId, range.startDate, range.endDate);
    });

  // Filtragem dos estudantes para a visualização do representante atual
  const filteredStudents = useMemo(() => {
    if (!currentRepObj) return [];
    return studentsData.filter(
      (s) => s.representativeName === currentRepObj.Representative || s.representativeId === currentRepObj.id
    );
  }, [studentsData, currentRepObj]);

  // Quantidade de semanas do mês atual (4 ou 5)
  const monthWeeksCount = useMemo(() => {
    if (!selectedMonth) return 4;
    const [yearStr, monthStr] = selectedMonth.split('-');
    const lastDay = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
    return lastDay > 28 ? 5 : 4;
  }, [selectedMonth]);

  const currentYear = useMemo(() => parseInt(selectedMonth.split('-')[0], 10), [selectedMonth]);
  const currentMonthNum = useMemo(() => parseInt(selectedMonth.split('-')[1], 10), [selectedMonth]);

  const currentRepWfeWeeks = useMemo(
    () => wfeEligibleWeeksFor(currentRepObj?.id),
    [currentRepObj?.id, wfePeriods, selectedMonth, monthWeeksCount]
  );
  const isCurrentRepWFE = currentRepWfeWeeks.length > 0;

  // ── Alunos do time WFE no mês ──
  const allWfeStudents = useMemo(() => {
    return studentsData.filter((s) => s.isWFE);
  }, [studentsData]);

  // ── Breakdown por Representante no Mês (Apenas para Admin) ──
  const repBreakdownList = useMemo(() => {
    const weeks = [1, 2, 3, 4, 5];
    const wfeCountsByWeek = weeks.map((wNum) => allWfeStudents.filter((s) => s.weekNumber === wNum).length);
    return representatives
      .filter((r) => !EXCLUDED_REPRESENTATIVES.includes(r.Representative))
      .map((rep) => {
        const eligibleWfeWeeks = wfeEligibleWeeksFor(rep.id);
        const isWfeRep = eligibleWfeWeeks.length > 0;

        // Alunos individuais TTPA do representante
        const repTtpaStudents = studentsData.filter(
          (s) => (s.representativeName === rep.Representative || s.representativeId === rep.id) && !s.isWFE
        );

        const ttpaCountsByWeek = weeks.map((wNum) => repTtpaStudents.filter((s) => s.weekNumber === wNum).length);
        const ttpaWeeklyBonus = ttpaCountsByWeek.reduce((sum, c) => sum + c * getTTPAWeekRate(c).rate, 0);
        const ttpaMonthlyBonus = getTTPAMonthlyBonus(repTtpaStudents.length).bonus;
        const ttpaTotal = ttpaWeeklyBonus + ttpaMonthlyBonus;

        // Se for WFE, soma a bonificação TTPA individual com o pool coletivo WFE
        if (isWfeRep) {
          const eligibleIndexes = eligibleWfeWeeks.map((week) => week - 1);
          const eligibleWfeStudents = eligibleIndexes.reduce((sum, index) => sum + wfeCountsByWeek[index], 0);
          const eligibleWfeWeeklyBonus = eligibleIndexes.reduce((sum, index) => {
            const count = wfeCountsByWeek[index];
            return sum + count * getWFEWeekRate(count).rate;
          }, 0);
          const eligibleWfeAdditionalBonus = eligibleIndexes.reduce(
            (sum, index) => sum + getWFEWeekRate(wfeCountsByWeek[index]).additionalBonus,
            0
          );
          const totalStudents = repTtpaStudents.length + eligibleWfeStudents;
          const weeklyBonus = ttpaWeeklyBonus + eligibleWfeWeeklyBonus;
          const monthlyOrAddBonus = ttpaMonthlyBonus + eligibleWfeAdditionalBonus;
          const totalBonus = ttpaTotal + eligibleWfeWeeklyBonus + eligibleWfeAdditionalBonus;
          const countsByWeek = weeks.map((_, idx) =>
            ttpaCountsByWeek[idx] + (eligibleIndexes.includes(idx) ? wfeCountsByWeek[idx] : 0)
          );

          return {
            id: rep.id,
            name: rep.Representative,
            isWfe: true,
            type: repTtpaStudents.length > 0 ? 'TTPA + WFE' : 'WFE',
            studentsCount: totalStudents,
            weeklyBonus,
            monthlyOrAddBonus,
            totalBonus,
            countsByWeek,
          };
        }

        return {
          id: rep.id,
          name: rep.Representative,
          isWfe: false,
          type: 'TTPA',
          studentsCount: repTtpaStudents.length,
          weeklyBonus: ttpaWeeklyBonus,
          monthlyOrAddBonus: ttpaMonthlyBonus,
          totalBonus: ttpaTotal,
          countsByWeek: ttpaCountsByWeek,
        };
      })
      .sort((a, b) => b.totalBonus - a.totalBonus || b.studentsCount - a.studentsCount);
  }, [representatives, studentsData, allWfeStudents, wfePeriods, selectedMonth, monthWeeksCount]);

  // ── Cálculo da Matriz TTPA (Específica do Representante TTPA Selecionado) ──
  const ttpaMatrixData = useMemo(() => {
    const weeks = Array.from({ length: monthWeeksCount }, (_, i) => i + 1);

    const weekStats = weeks.map((wNum) => {
      const weekStudents = filteredStudents.filter((s) => !s.isWFE && s.weekNumber === wNum);
      const count = weekStudents.length;
      const rateInfo = getTTPAWeekRate(count);
      const weeklyBonus = count * rateInfo.rate;
      return {
        weekNumber: wNum,
        rangeLabel: getWeekRangeLabel(currentYear, currentMonthNum, wNum),
        studentsCount: count,
        rate: rateInfo.rate,
        rateLabel: rateInfo.label,
        weeklyBonus,
      };
    });

    const totalStudents = weekStats.reduce((sum, w) => sum + w.studentsCount, 0);
    const sumWeeklyBonus = weekStats.reduce((sum, w) => sum + w.weeklyBonus, 0);
    const monthlyBonusInfo = getTTPAMonthlyBonus(totalStudents);
    const totalBonus = sumWeeklyBonus + monthlyBonusInfo.bonus;

    const maxStudentsInWeek = Math.max(...weekStats.map((w) => w.studentsCount), 0);
    const bestWeekNum = maxStudentsInWeek > 0 ? weekStats.find((w) => w.studentsCount === maxStudentsInWeek)?.weekNumber : null;

    return {
      weekStats,
      totalStudents,
      sumWeeklyBonus,
      monthlyBonus: monthlyBonusInfo.bonus,
      monthlyBonusLabel: monthlyBonusInfo.tierLabel,
      totalBonus,
      bestWeekNum,
    };
  }, [filteredStudents, monthWeeksCount, currentYear, currentMonthNum]);

  // ── Cálculo da Matriz WFE (Total Coletivo do Time WFE) ──
  const wfeMatrixData = useMemo(() => {
    const weeks = Array.from({ length: monthWeeksCount }, (_, i) => i + 1);

    const weekStats = weeks.map((wNum) => {
      // WFE é coletivo da equipe: soma todos os alunos WFE do time na semana
      const isEligibleWeek = currentRepWfeWeeks.includes(wNum);
      const weekStudents = isEligibleWeek ? allWfeStudents.filter((s) => s.weekNumber === wNum) : [];
      const count = weekStudents.length;
      const wfeInfo = getWFEWeekRate(count);
      const weeklyBonus = count * wfeInfo.rate;
      const additionalBonus = wfeInfo.additionalBonus;
      const totalWeekBonus = weeklyBonus + additionalBonus;

      return {
        weekNumber: wNum,
        rangeLabel: getWeekRangeLabel(currentYear, currentMonthNum, wNum),
        studentsCount: count,
        rate: wfeInfo.rate,
        rateLabel: wfeInfo.label,
        weeklyBonus,
        additionalBonus,
        totalWeekBonus,
      };
    });

    const totalStudents = weekStats.reduce((sum, w) => sum + w.studentsCount, 0);
    const sumWeeklyBonus = weekStats.reduce((sum, w) => sum + w.weeklyBonus, 0);
    const sumAdditionalBonus = weekStats.reduce((sum, w) => sum + w.additionalBonus, 0);
    const totalBonus = sumWeeklyBonus + sumAdditionalBonus;

    const maxStudentsInWeek = Math.max(...weekStats.map((w) => w.studentsCount), 0);
    const bestWeekNum = maxStudentsInWeek > 0 ? weekStats.find((w) => w.studentsCount === maxStudentsInWeek)?.weekNumber : null;

    return {
      weekStats,
      totalStudents,
      sumWeeklyBonus,
      sumAdditionalBonus,
      totalBonus,
      bestWeekNum,
    };
  }, [allWfeStudents, monthWeeksCount, currentYear, currentMonthNum, currentRepWfeWeeks]);

  // ── KPIs do Representante / Time Selecionado (Somando TTPA + WFE) ──
  const representativeKpis = useMemo(() => {
    if (isCurrentRepWFE) {
      const totalStudents = ttpaMatrixData.totalStudents + wfeMatrixData.totalStudents;
      const totalBonus = ttpaMatrixData.totalBonus + wfeMatrixData.totalBonus;
      return {
        totalStudents,
        totalBonus,
        totalBonusBRL: totalBonus * brlRate,
        programLabel: ttpaMatrixData.totalStudents > 0 ? 'TTPA + Workforce (WFE)' : 'Workforce (WFE)',
      };
    }

    return {
      totalStudents: ttpaMatrixData.totalStudents,
      totalBonus: ttpaMatrixData.totalBonus,
      totalBonusBRL: ttpaMatrixData.totalBonus * brlRate,
      programLabel: 'TTPA Standard',
    };
  }, [isCurrentRepWFE, ttpaMatrixData, wfeMatrixData, brlRate]);

  // ── Tabela de Alunos Respeitando RLS / Admin / Time WFE ──
  const tableStudents = useMemo(() => {
    let baseList = studentsData;
    if (!isAdmin) {
      baseList = isCurrentRepWFE
        ? studentsData.filter((s) => s.isWFE || s.representativeName === selectedRep)
        : filteredStudents;
    }

    if (!searchTerm.trim()) return baseList;
    const term = searchTerm.toLowerCase();
    return baseList.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        s.representativeName.toLowerCase().includes(term) ||
        s.program?.toLowerCase().includes(term)
    );
  }, [studentsData, filteredStudents, isAdmin, isCurrentRepWFE, selectedRep, searchTerm]);

  // ── Cálculo do Simulador Interativo ──
  const simTTPA = useMemo(() => {
    const weekRates = calcWeeks.map((c) => getTTPAWeekRate(c));
    const weekBonuses = calcWeeks.map((c, i) => c * weekRates[i].rate);
    const totalStudents = calcWeeks.reduce((a, b) => a + b, 0);
    const sumWeekBonus = weekBonuses.reduce((a, b) => a + b, 0);
    const mBonusInfo = getTTPAMonthlyBonus(totalStudents);
    const totalBonus = sumWeekBonus + mBonusInfo.bonus;

    return {
      weekBonuses,
      weekRates,
      totalStudents,
      sumWeekBonus,
      mBonus: mBonusInfo.bonus,
      totalBonus,
    };
  }, [calcWeeks]);

  const simWFE = useMemo(() => {
    const wInfo = getWFEWeekRate(calcWfeStudents);
    const studentBonus = calcWfeStudents * wInfo.rate;
    const totalBonus = studentBonus + wInfo.additionalBonus;

    return {
      rate: wInfo.rate,
      studentBonus,
      additionalBonus: wInfo.additionalBonus,
      totalBonus,
    };
  }, [calcWfeStudents]);

  // Condição para exibição da matriz TTPA e WFE
  const shouldShowTTPAMatrix = !isCurrentRepWFE || (isCurrentRepWFE && ttpaMatrixData.totalStudents > 0);
  const shouldShowWFEMatrix = isCurrentRepWFE;

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1680px', margin: '0 auto', fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}>
      
      {/* ── Modern App Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              TTPA Bonus Dashboard
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 9px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: '#D97706',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              <Sparkles size={11} />
              PROGRAM 2026
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
            Live financial performance & bonus calculation tracking for TTPA and Workforce Evolved representatives based on enrolled students.
          </p>
        </div>

        {/* Action Controls & External Guide */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <a
            href="https://ttpa-bonus-program.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <Gift size={14} style={{ color: '#F59E0B' }} />
            <span>Official Rules</span>
            <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
          </a>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--ttpa-blue-primary)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.2s ease',
            }}
          >
            <RotateCw size={13} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ── Modern Floating Filters Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          borderRadius: '12px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 16px -4px rgba(15, 23, 42, 0.04)',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Representative Selector (Always Single Rep, No 'All' option) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(37, 99, 235, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Filter size={14} style={{ color: 'var(--ttpa-blue-primary)' }} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Representative:
            </span>
            <select
              value={selectedRep}
              onChange={(e) => setSelectedRep(e.target.value)}
              disabled={!isAdmin && !!userRepId}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-medium)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
                minWidth: '220px',
                cursor: !isAdmin && !!userRepId ? 'not-allowed' : 'pointer',
              }}
            >
              {representatives.map((rep) => (
                <option key={rep.id} value={rep.Representative}>
                  {rep.Representative}
                </option>
              ))}
            </select>
          </div>

          {/* Month Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={14} style={{ color: '#D97706' }} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Month:
            </span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-medium)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
                minWidth: '160px',
                cursor: 'pointer',
              }}
            >
              {availableMonths.map((m) => (
                <option key={m.monthKey} value={m.monthKey}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsWfeSettingsOpen((isOpen) => !isOpen)}
              aria-expanded={isWfeSettingsOpen}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 9px',
                borderRadius: '6px', border: '1px solid rgba(234, 88, 12, 0.26)',
                backgroundColor: isWfeSettingsOpen ? 'rgba(234, 88, 12, 0.09)' : 'var(--bg-app)',
                color: '#C2410C', fontSize: '11px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              WFE Reps {wfePeriods.length > 0 ? `(${wfePeriods.length})` : ''}
              {isWfeSettingsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>

        {/* Currency Rate Widget */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: isRateLive ? 'var(--emerald-500)' : 'var(--slate-400)',
                boxShadow: isRateLive ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none',
              }}
            />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {isRateLive ? (rateSource || 'USD/BRL') : 'USD/BRL Rate'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>R$</span>
            <input
              type="number"
              value={brlRate}
              step="0.01"
              min="1"
              max="15"
              title="Current exchange rate (manually adjustable)"
              onChange={(e) => {
                setBrlRate(parseFloat(e.target.value) || 5.20);
                setIsRateLive(false);
              }}
              style={{
                width: '58px',
                border: 'none',
                background: 'transparent',
                fontWeight: 800,
                fontSize: '12px',
                color: 'var(--text-primary)',
                outline: 'none',
                textAlign: 'right',
              }}
            />
          </div>

          <button
            onClick={fetchLiveExchangeRate}
            disabled={isLoadingRate}
            title="Refresh live exchange rate from Central Bank"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: isLoadingRate ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
              transition: 'color 0.2s ease',
            }}
          >
            <RotateCw size={11} style={{ animation: isLoadingRate ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {isAdmin && isWfeSettingsOpen && (
        <section
          style={{
            marginTop: '-24px',
            marginBottom: '24px',
            padding: '12px 16px',
            borderRadius: '0 0 12px 12px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderTop: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                WFE Reps
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                Participation dates for the WFE pool.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.4fr) minmax(130px, 0.8fr) minmax(130px, 0.8fr) auto', gap: '8px', alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: '5px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Representative
              <select value={newWfePeriod.representativeId} onChange={(e) => setNewWfePeriod((prev) => ({ ...prev, representativeId: e.target.value }))} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
                {representatives.map((rep) => <option key={rep.id} value={rep.id}>{rep.Representative}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: '5px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Start date
              <input type="date" min={`${BONUS_MIN_MONTH}-01`} value={newWfePeriod.startDate} onChange={(e) => setNewWfePeriod((prev) => ({ ...prev, startDate: e.target.value }))} style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--bg-app)', color: 'var(--text-primary)' }} />
            </label>
            <label style={{ display: 'grid', gap: '5px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              End date <span style={{ fontWeight: 500 }}>(optional)</span>
              <input type="date" min={newWfePeriod.startDate || `${BONUS_MIN_MONTH}-01`} value={newWfePeriod.endDate} onChange={(e) => setNewWfePeriod((prev) => ({ ...prev, endDate: e.target.value }))} style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--bg-app)', color: 'var(--text-primary)' }} />
            </label>
            <button onClick={saveWfePeriod} disabled={isSavingWfePeriod} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', minHeight: '31px', padding: '6px 9px', border: 'none', borderRadius: '6px', background: '#EA580C', color: '#fff', fontSize: '11px', fontWeight: 800, cursor: isSavingWfePeriod ? 'not-allowed' : 'pointer' }}>
              {isSavingWfePeriod ? <Save size={14} /> : <Plus size={14} />}
              {isSavingWfePeriod ? 'Saving...' : 'Add period'}
            </button>
          </div>

          {wfePeriodMessage && <p style={{ margin: '10px 0 0', fontSize: '12px', color: wfePeriodMessage === 'WFE period saved.' || wfePeriodMessage === 'WFE period removed.' ? 'var(--emerald-600)' : 'var(--color-danger)' }}>{wfePeriodMessage}</p>}

          <div style={{ marginTop: '10px', overflowX: 'auto', borderTop: '1px solid var(--border-subtle)' }}>
            {wfePeriods.length === 0 ? (
              <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>No periods configured yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead><tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}><th style={{ padding: '7px 8px' }}>Representative</th><th style={{ padding: '7px 8px' }}>Start</th><th style={{ padding: '7px 8px' }}>End</th><th style={{ padding: '7px 8px' }} /></tr></thead>
                <tbody>{wfePeriods.map((period) => {
                  const representative = representatives.find((rep) => rep.id === period.representative_id);
                  return <tr key={period.id} style={{ borderTop: '1px solid var(--border-subtle)' }}><td style={{ padding: '6px 8px', fontWeight: 700 }}>{representative?.Representative || 'Unknown representative'}</td><td style={{ padding: '6px 8px' }}>{period.start_date}</td><td style={{ padding: '6px 8px' }}>{period.end_date || 'Ongoing'}</td><td style={{ padding: '4px 8px', textAlign: 'right' }}><button onClick={() => deleteWfePeriod(period.id)} title="Remove WFE period" style={{ display: 'inline-flex', border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', padding: '3px' }}><Trash2 size={14} /></button></td></tr>;
                })}</tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* ── Modern KPI Cards Grid (For Selected Representative) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {/* KPI 1: Students */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Enrolled Students
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} style={{ color: 'var(--ttpa-blue-primary)' }} />
            </div>
          </div>
          <div>
            <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em' }}>
              {representativeKpis.totalStudents}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
              {isCurrentRepWFE ? `WFE Team Total in ${selectedMonth}` : `${selectedRep} in ${selectedMonth}`}
            </span>
          </div>
        </div>

        {/* KPI 2: Total Bonus USD */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Estimated Bonus (USD)
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={16} style={{ color: '#D97706' }} />
            </div>
          </div>
          <div>
            <span style={{ fontSize: '32px', fontWeight: 900, color: '#D97706', lineHeight: 1, letterSpacing: '-0.03em' }}>
              {formatUSD(representativeKpis.totalBonus)}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--emerald-600)', fontWeight: 800, display: 'block', marginTop: '6px' }}>
              {formatBRL(representativeKpis.totalBonus)}
            </span>
          </div>
        </div>

        {/* KPI 3: Total Bonus BRL */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              BRL Equivalent
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={16} style={{ color: 'var(--emerald-600)' }} />
            </div>
          </div>
          <div>
            <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--emerald-600)', lineHeight: 1, letterSpacing: '-0.03em' }}>
              {formatBRL(representativeKpis.totalBonus)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
              Rate: R$ {brlRate.toFixed(2)}
            </span>
          </div>
        </div>

        {/* KPI 4: Team Role */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Team Program
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: isCurrentRepWFE ? 'rgba(234, 88, 12, 0.1)' : 'rgba(37, 99, 235, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} style={{ color: isCurrentRepWFE ? '#EA580C' : 'var(--ttpa-blue-primary)' }} />
            </div>
          </div>
          <div>
            <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {representativeKpis.programLabel}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
              {isCurrentRepWFE ? 'TTPA + Pool Coletivo WFE' : 'Weekly rate + Monthly bonus'}
            </span>
          </div>
        </div>
      </div>

      {/* ── LINHA 1: TTPA BONUS PER WEEK (Palette de cores por semana) ── */}
      {shouldShowTTPAMatrix && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--ttpa-blue-primary)' }} />
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                TTPA Bonus per Week
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                • Independent Weekly Rate + Monthly Performance Bonus
              </span>
            </div>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                color: 'var(--ttpa-blue-primary)',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {selectedRep}
            </span>
          </div>

          {/* Cards Grid TTPA com cores separadas por semana */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${monthWeeksCount + 1}, minmax(190px, 1fr))`,
              gap: '14px',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            {/* Cards Semanais */}
            {ttpaMatrixData.weekStats.map((week, idx) => {
              const isBest = week.weekNumber === ttpaMatrixData.bestWeekNum && week.studentsCount > 0;
              const palette = WEEK_PALETTE[idx % WEEK_PALETTE.length];

              return (
                <div
                  key={week.weekNumber}
                  style={{
                    padding: '20px 18px',
                    borderRadius: '14px',
                    backgroundColor: 'var(--bg-surface)',
                    border: isBest ? `2px solid ${palette.color}` : '1px solid var(--border-subtle)',
                    boxShadow: isBest ? `0 8px 24px -4px ${palette.lightBg}` : '0 2px 8px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '220px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: palette.color, letterSpacing: '0.02em' }}>
                        WEEK {week.weekNumber}
                      </span>

                      {isBest && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '2px 7px',
                            borderRadius: '9999px',
                            backgroundColor: palette.badgeBg,
                            color: palette.badgeText,
                            fontSize: '10px',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          <Flame size={10} />
                          BEST WEEK
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '16px' }}>
                      {week.rangeLabel}
                    </span>

                    {/* Students Display */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                          {week.studentsCount}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                          students
                        </span>
                      </div>

                      <div style={{ marginTop: '6px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: week.weeklyBonus > 0 ? palette.lightBg : 'var(--bg-app)',
                            color: week.weeklyBonus > 0 ? palette.color : 'var(--text-muted)',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {week.rateLabel}
                        </span>
                      </div>
                    </div>

                    {/* Barra Visual Colorida */}
                    <div style={{ height: '4px', width: '100%', backgroundColor: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', marginBottom: '14px' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (week.studentsCount / 4) * 100)}%`,
                          backgroundColor: palette.color,
                          borderRadius: '2px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Weekly Bonus Value */}
                  <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Weekly Bonus
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: 900, color: week.weeklyBonus > 0 ? 'var(--emerald-600)' : 'var(--text-muted)' }}>
                      {formatUSD(week.weeklyBonus)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Total Month Card (Blue Theme) */}
            <div
              style={{
                padding: '20px 18px',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-surface)',
                border: '2px solid rgba(37, 99, 235, 0.4)',
                boxShadow: '0 4px 16px -2px rgba(37, 99, 235, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '220px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ttpa-blue-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    TOTAL MONTH
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--ttpa-blue-primary)' }}>
                    TTPA
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '14px' }}>
                  Monthly Consolidated
                </span>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Students:</span>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{ttpaMatrixData.totalStudents}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Weekly Sum:</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{formatUSD(ttpaMatrixData.sumWeeklyBonus)}</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    border: '1px solid rgba(37, 99, 235, 0.15)',
                    marginBottom: '10px',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--ttpa-blue-primary)', fontWeight: 700 }}>Monthly Bonus:</span>
                  <span style={{ fontSize: '13px', fontWeight: 900, color: 'var(--ttpa-blue-primary)' }}>+{formatUSD(ttpaMatrixData.monthlyBonus)}</span>
                </div>
              </div>

              {/* Total Final */}
              <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                  Total TTPA Bonus
                </span>
                <span style={{ fontSize: '26px', fontWeight: 900, color: 'var(--ttpa-blue-primary)', lineHeight: 1.1, display: 'block' }}>
                  {formatUSD(ttpaMatrixData.totalBonus)}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--emerald-600)', fontWeight: 800, marginTop: '2px', display: 'block' }}>
                  ≈ {formatBRL(ttpaMatrixData.totalBonus)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LINHA 2: WFE BONUS PER WEEK (Orange Theme Accent) ── */}
      {shouldShowWFEMatrix && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EA580C' }} />
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                WFE Bonus per Week
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                • Workforce Evolved Structure ($5, $7.50, $10, $15/student + $100 bonus at 9+)
              </span>
            </div>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(234, 88, 12, 0.08)',
                color: '#EA580C',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {selectedRep} • WFE Team Pool
            </span>
          </div>

          {/* Cards Grid WFE */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${monthWeeksCount + 1}, minmax(190px, 1fr))`,
              gap: '14px',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            {wfeMatrixData.weekStats.map((week, idx) => {
              const isHitMax = week.studentsCount >= 9;
              const palette = WEEK_PALETTE[idx % WEEK_PALETTE.length];

              return (
                <div
                  key={week.weekNumber}
                  style={{
                    padding: '20px 18px',
                    borderRadius: '14px',
                    backgroundColor: 'var(--bg-surface)',
                    border: isHitMax ? '2px solid rgba(234, 88, 12, 0.6)' : '1px solid var(--border-subtle)',
                    boxShadow: isHitMax ? '0 8px 24px -4px rgba(234, 88, 12, 0.15)' : '0 2px 8px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '220px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#EA580C', letterSpacing: '0.02em' }}>
                        WEEK {week.weekNumber}
                      </span>
                      {isHitMax && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '2px 7px',
                            borderRadius: '9999px',
                            backgroundColor: '#FFEDD5',
                            color: '#C2410C',
                            fontSize: '10px',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          <Zap size={10} />
                          +$100 EXTRA
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '16px' }}>
                      {week.rangeLabel}
                    </span>

                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                          {week.studentsCount}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                          students
                        </span>
                      </div>

                      <div style={{ marginTop: '6px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: week.rate > 0 ? 'rgba(234, 88, 12, 0.08)' : 'var(--bg-app)',
                            color: week.rate > 0 ? '#EA580C' : 'var(--text-muted)',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {week.rateLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Week Total
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: 900, color: week.totalWeekBonus > 0 ? '#EA580C' : 'var(--text-muted)' }}>
                      {formatUSD(week.totalWeekBonus)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Total WFE Card (Orange / Amber Theme) */}
            <div
              style={{
                padding: '20px 18px',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-surface)',
                border: '2px solid rgba(234, 88, 12, 0.4)',
                boxShadow: '0 4px 16px -2px rgba(234, 88, 12, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '220px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#EA580C', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    TOTAL WFE
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(234, 88, 12, 0.1)', color: '#EA580C' }}>
                    WFE
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '14px' }}>
                  Workforce Consolidated
                </span>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Students:</span>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{wfeMatrixData.totalStudents}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Weekly Bonus:</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{formatUSD(wfeMatrixData.sumWeeklyBonus)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#D97706', fontWeight: 600 }}>Additional (9+):</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#D97706' }}>+{formatUSD(wfeMatrixData.sumAdditionalBonus)}</span>
                </div>
              </div>

              <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                  Total WFE Bonus
                </span>
                <span style={{ fontSize: '26px', fontWeight: 900, color: '#EA580C', lineHeight: 1.1, display: 'block' }}>
                  {formatUSD(wfeMatrixData.totalBonus)}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--emerald-600)', fontWeight: 800, marginTop: '2px', display: 'block' }}>
                  ≈ {formatBRL(wfeMatrixData.totalBonus)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LINHA 3: DEMONSTRATIVO POR REPRESENTANTE (Visível APENAS para ADMIN) ── */}
      {isAdmin && (
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              padding: '20px 24px',
              borderRadius: '14px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Representative Performance Breakdown
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Admin exclusive overview. Click on any row to isolate the matrix view for that representative.
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Representative</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Team</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Wk 1</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Wk 2</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Wk 3</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Wk 4</th>
                    {monthWeeksCount === 5 && (
                      <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Wk 5</th>
                    )}
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>Total Students</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Weekly Bonus</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Monthly / Extra</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right', color: '#D97706' }}>Total (USD)</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right', color: 'var(--emerald-600)' }}>Total (BRL)</th>
                  </tr>
                </thead>
                <tbody>
                  {repBreakdownList.map((rep, idx) => {
                    const isSelected = selectedRep === rep.name;
                    return (
                      <tr
                        key={rep.id}
                        onClick={() => setSelectedRep(rep.name)}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-app)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '18px', fontSize: '11px', color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          <span>{rep.name}</span>
                          {isSelected && (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(37, 99, 235, 0.15)', color: 'var(--ttpa-blue-primary)' }}>
                              Selected
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: rep.isWfe ? 'rgba(234, 88, 12, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                              color: rep.isWfe ? '#EA580C' : 'var(--ttpa-blue-primary)',
                            }}
                          >
                            {rep.type || (rep.isWfe ? 'WFE' : 'TTPA')}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: rep.countsByWeek[0] > 0 ? 800 : 400, color: rep.countsByWeek[0] > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {rep.countsByWeek[0]}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: rep.countsByWeek[1] > 0 ? 800 : 400, color: rep.countsByWeek[1] > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {rep.countsByWeek[1]}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: rep.countsByWeek[2] > 0 ? 800 : 400, color: rep.countsByWeek[2] > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {rep.countsByWeek[2]}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: rep.countsByWeek[3] > 0 ? 800 : 400, color: rep.countsByWeek[3] > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {rep.countsByWeek[3]}
                        </td>
                        {monthWeeksCount === 5 && (
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: rep.countsByWeek[4] > 0 ? 800 : 400, color: rep.countsByWeek[4] > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {rep.countsByWeek[4]}
                          </td>
                        )}
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 900, color: 'var(--text-primary)', fontSize: '14px' }}>
                          {rep.studentsCount}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: rep.weeklyBonus > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {formatUSD(rep.weeklyBonus)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: rep.monthlyOrAddBonus > 0 ? '#D97706' : 'var(--text-muted)' }}>
                          {rep.monthlyOrAddBonus > 0 ? `+${formatUSD(rep.monthlyOrAddBonus)}` : '$0.00'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 900, color: rep.totalBonus > 0 ? '#D97706' : 'var(--text-muted)', fontSize: '14px' }}>
                          {formatUSD(rep.totalBonus)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: rep.totalBonus > 0 ? 'var(--emerald-600)' : 'var(--text-muted)', fontSize: '13px' }}>
                          {formatBRL(rep.totalBonus)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── LINHA 4: SIMULADOR INTERATIVO (Adaptive Light/Dark Theme) ── */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            padding: '24px',
            borderRadius: '14px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calculator size={18} style={{ color: '#D97706' }} />
                <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Interactive Bonus Calculator
                </h2>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Adjust the number of students per week to project instant earnings in USD and BRL.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-app)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => setCalcMode('ttpa')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: calcMode === 'ttpa' ? 'var(--ttpa-blue-primary)' : 'transparent',
                  color: calcMode === 'ttpa' ? '#FFFFFF' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease',
                }}
              >
                TTPA Calculator
              </button>
              <button
                onClick={() => setCalcMode('wfe')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: calcMode === 'wfe' ? '#EA580C' : 'transparent',
                  color: calcMode === 'wfe' ? '#FFFFFF' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease',
                }}
              >
                WFE Calculator
              </button>
            </div>
          </div>

          {calcMode === 'ttpa' ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                {calcWeeks.map((val, idx) => (
                  <div key={idx} style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                      Week {idx + 1}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={val}
                      onChange={(e) => {
                        const newVal = Math.max(0, parseInt(e.target.value) || 0);
                        const updated = [...calcWeeks];
                        updated[idx] = newVal;
                        setCalcWeeks(updated);
                      }}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        color: 'var(--text-primary)',
                        fontSize: '18px',
                        fontWeight: 800,
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--ttpa-blue-primary)', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                      {val} × ${getTTPAWeekRate(val).rate} = ${val * getTTPAWeekRate(val).rate}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '12px',
                  backgroundColor: 'var(--bg-app)',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                    Total Students
                  </span>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>{simTTPA.totalStudents}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                    Weekly Sum
                  </span>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>{formatUSD(simTTPA.sumWeekBonus)}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                    Monthly Bonus
                  </span>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--ttpa-blue-primary)' }}>+{formatUSD(simTTPA.mBonus)}</span>
                </div>
                <div style={{ borderLeft: '2px solid var(--ttpa-blue-primary)', paddingLeft: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--ttpa-blue-primary)', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>
                    Simulated Total Bonus
                  </span>
                  <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--ttpa-blue-primary)', lineHeight: 1.1 }}>
                    {formatUSD(simTTPA.totalBonus)}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--emerald-600)', display: 'block', marginTop: '2px' }}>
                    ≈ {formatBRL(simTTPA.totalBonus)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Students in Week / Month
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={calcWfeStudents}
                    onChange={(e) => setCalcWfeStudents(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '20px',
                      fontWeight: 800,
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: '#EA580C', fontWeight: 600, display: 'block', marginTop: '6px' }}>
                    Tier: {calcWfeStudents >= 9 ? '9+ ($15/student + $100)' : `$${simWFE.rate}/student`}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '12px',
                  backgroundColor: 'var(--bg-app)',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                    Students
                  </span>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>{calcWfeStudents}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                    Rate Bonus
                  </span>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>{formatUSD(simWFE.studentBonus)}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                    Extra (9+)
                  </span>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: '#EA580C' }}>+{formatUSD(simWFE.additionalBonus)}</span>
                </div>
                <div style={{ borderLeft: '2px solid #EA580C', paddingLeft: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#EA580C', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>
                    Simulated WFE Bonus
                  </span>
                  <span style={{ fontSize: '24px', fontWeight: 900, color: '#EA580C', lineHeight: 1.1 }}>
                    {formatUSD(simWFE.totalBonus)}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--emerald-600)', display: 'block', marginTop: '2px' }}>
                    ≈ {formatBRL(simWFE.totalBonus)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── LINHA 5: LISTA DE ALUNOS MATRICULADOS (Com CRM Link & WFE/Unassigned Resolution) ── */}
      <div>
        <div
          style={{
            padding: '20px 24px',
            borderRadius: '14px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Enrolled Students in Period ({tableStudents.length})
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Individual student records from <code>fStudents</code>.
              </p>
            </div>

            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search student, email, rep..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Student</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Email</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Enrollment Date</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Week</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Representative</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Program</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Stage</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>CRM Link</th>
                  {isAdmin && <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Fix</th>}
                </tr>
              </thead>
              <tbody>
                {tableStudents.map((st) => (
                  <tr key={st.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {st.name}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      {st.email}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {st.date}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: WEEK_PALETTE[(st.weekNumber - 1) % WEEK_PALETTE.length]?.lightBg || 'rgba(37, 99, 235, 0.08)',
                          color: WEEK_PALETTE[(st.weekNumber - 1) % WEEK_PALETTE.length]?.color || 'var(--ttpa-blue-primary)',
                        }}
                      >
                        Week {st.weekNumber}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {st.isUnassigned ? (
                        <span style={{ color: '#EF4444', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          ● Unassigned
                        </span>
                      ) : st.representativeName === 'WFE' ? (
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: 'rgba(234, 88, 12, 0.1)',
                            color: '#EA580C',
                          }}
                        >
                          WFE
                        </span>
                      ) : (
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {st.representativeName}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      {st.program}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald-600)' }}>
                        {st.stage}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {st.crmUrl ? (
                        <a
                          href={st.crmUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open contact in CRM"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(37, 99, 235, 0.08)',
                            color: 'var(--ttpa-blue-primary)',
                            textDecoration: 'none',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <ExternalLink size={13} />
                        </a>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openRepresentativeFix(st)}
                          title="Set WFE or representative"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '28px', borderRadius: '6px', border: 'none',
                            backgroundColor: 'rgba(234, 88, 12, 0.10)', color: '#C2410C', cursor: 'pointer',
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}

                {tableStudents.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No enrolled students found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isAdmin && fixStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="representative-fix-title"
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: '20px', backgroundColor: 'rgba(15, 23, 42, 0.42)' }}
          onMouseDown={() => !isSavingFix && setFixStudent(null)}
        >
          <section
            onMouseDown={(event) => event.stopPropagation()}
            style={{ width: '100%', maxWidth: '440px', padding: '20px', borderRadius: '12px', backgroundColor: 'var(--bg-surface)', boxShadow: '0 20px 48px rgba(15, 23, 42, 0.28)', border: '1px solid var(--border-subtle)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start', marginBottom: '16px' }}>
              <div>
                <h2 id="representative-fix-title" style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px', fontWeight: 800 }}>Representative fix</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>{fixStudent.name} · {fixStudent.email}</p>
              </div>
              <button type="button" onClick={() => setFixStudent(null)} disabled={isSavingFix} aria-label="Close" style={{ display: 'inline-flex', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', border: `1px solid ${fixMode === 'wfe' ? 'rgba(234, 88, 12, 0.45)' : 'var(--border-subtle)'}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: fixMode === 'wfe' ? 'rgba(234, 88, 12, 0.06)' : 'transparent' }}>
                <input type="radio" name="representative-fix" checked={fixMode === 'wfe'} onChange={() => setFixMode('wfe')} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Mark as WFE</span>
              </label>
              <label style={{ display: 'grid', gap: '6px', padding: '10px', border: `1px solid ${fixMode === 'representative' ? 'rgba(37, 99, 235, 0.42)' : 'var(--border-subtle)'}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: fixMode === 'representative' ? 'rgba(37, 99, 235, 0.05)' : 'transparent' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="radio" name="representative-fix" checked={fixMode === 'representative'} onChange={() => setFixMode('representative')} /><span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Assign representative</span></span>
                <select value={fixRepresentativeId} disabled={fixMode !== 'representative'} onChange={(event) => setFixRepresentativeId(event.target.value)} style={{ padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12px' }}>
                  <option value="">Select representative</option>
                  {representatives.map((rep) => <option key={rep.id} value={rep.id}>{rep.Representative}</option>)}
                </select>
              </label>
            </div>

            {fixMessage && <p style={{ margin: '12px 0 0', color: 'var(--color-danger)', fontSize: '12px' }}>{fixMessage}</p>}
            <div style={{ display: 'flex', justifyContent: 'end', gap: '8px', marginTop: '18px' }}>
              <button type="button" onClick={() => setFixStudent(null)} disabled={isSavingFix} style={{ padding: '7px 11px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Cancel</button>
              <button type="button" onClick={saveRepresentativeFix} disabled={isSavingFix} style={{ padding: '7px 11px', borderRadius: '6px', border: 'none', background: 'var(--ttpa-blue-primary)', color: '#fff', cursor: isSavingFix ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 800 }}>{isSavingFix ? 'Saving...' : 'Save & refresh'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default TTPABonusDashboard;
