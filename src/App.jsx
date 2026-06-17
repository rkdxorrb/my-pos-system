import React, { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { 
  Home, ShoppingCart, Package, Users, FileText, 
  DollarSign, Search, Plus, Minus, Trash2, 
  CheckCircle, AlertCircle, ChevronRight, LogOut, Settings,
  UserPlus, ArrowLeft, TrendingUp, Calendar, BarChart, LineChart, Tag, Upload,
  ChevronUp, ChevronDown, Inbox, Printer, X, CalendarDays, List,
  Wallet, Megaphone, Bell, ArrowUp, GripVertical, Truck, Merge, ClipboardList, StickyNote, Pencil
} from 'lucide-react';

const DELIVERY_FEE = 4000;

// Firebase 연동 모듈
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: atob("QUl6YVN5QzR2WXE4NXZHVUFWNHhSYTA4S2ZVVzJWMnBHZ3FqU3pB"),
  authDomain: "my-store-pos-4b3d3.firebaseapp.com",
  projectId: "my-store-pos-4b3d3",
  storageBucket: "my-store-pos-4b3d3.firebasestorage.app",
  messagingSenderId: "435875811674",
  appId: "1:435875811674:web:1110f7752a2d1a7e51e363"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "my-store-pos-4b3d3";

const getTodayStr = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (9 * 3600000));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const d = String(kst.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** 한국시간 22:00 이후 판매는 익일 매출일자로 간주 (getTodayStr과 동일 기준 시각) */
const getDefaultTransactionDateStr = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (9 * 3600000));
  const hour = kst.getHours();
  const y = kst.getFullYear();
  const mo = kst.getMonth();
  const d = kst.getDate();
  if (hour >= 22) {
    const next = new Date(y, mo, d + 1);
    const ny = next.getFullYear();
    const nm = String(next.getMonth() + 1).padStart(2, '0');
    const nd = String(next.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  }
  const m = String(mo + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const getMonthStrOffset = (offsetMonths) => {
  const today = getTodayStr();
  const [y, m] = today.split('-').map(Number);
  const d = new Date(y, m - 1 + offsetMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getLastMonthStr = () => getMonthStrOffset(-1);

const shiftMonthStr = (monthStr, offsetMonths) => {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + offsetMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getFirstDayOfMonthStr = (monthStr) => `${monthStr}-01`;

const getSaleNetAmount = (sale) => {
  if (sale.type !== '판매' && sale.type !== '반품') return 0;
  const amt = (sale.actualPayment ?? 0) + (sale.appliedBalance ?? 0);
  return sale.type === '판매' ? amt : -amt;
};

const formatSalesStatsLabel = (key, tab) => {
  if (tab === 'yearly') return `${key}년`;
  if (tab === 'monthly') {
    const [y, m] = key.split('-');
    return y && m ? `${y}년 ${m}월` : key;
  }
  return key;
};

const getDayOfWeekKorean = (dateStr) => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const [y, m, d] = dateStr.split('-').map(Number);
  return days[new Date(y, m - 1, d).getDay()];
};

const getFirstSaleYearFromDailySales = (dailySales) => {
  let minYear = null;
  dailySales.forEach((sale) => {
    if (sale.type !== '판매' && sale.type !== '반품') return;
    if (!sale.date || sale.date.length < 4) return;
    const y = Number(sale.date.substring(0, 4));
    if (Number.isNaN(y)) return;
    if (minYear === null || y < minYear) minYear = y;
  });
  return minYear !== null ? String(minYear) : getTodayStr().substring(0, 4);
};

const SALES_STATS_BAR_PALETTE = [
  'bg-blue-600',
  'bg-indigo-500',
  'bg-violet-600',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-teal-600',
  'bg-cyan-600',
  'bg-sky-500',
  'bg-emerald-600',
  'bg-lime-600',
];

const formatCompactWon = (amount) => {
  if (amount === 0) return '—';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(1)}억`;
  if (abs >= 10000) return `${sign}${Math.round(abs / 10000)}만`;
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}천`;
  return `${sign}${abs.toLocaleString()}`;
};

const formatSalesStatsAxisLabel = (key, tab) => {
  if (tab === 'yearly') return `${key}`;
  if (tab === 'monthly') {
    const [, m] = key.split('-');
    return m ? `${Number(m)}월` : key;
  }
  if (key.length >= 10) {
    const day = key.slice(8, 10);
    return `${day}(${getDayOfWeekKorean(key)})`;
  }
  return key;
};

const addDaysToDateStr = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const getLastDayOfMonthStr = (monthOrDateStr) => {
  const mo = monthOrDateStr.substring(0, 7);
  const [y, m] = mo.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
};

const isWeekendDateStr = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
};

/** 금액 number 입력: 스크롤 휠로 값이 바뀌지 않도록 포커스 해제 */
const preventMoneyInputWheel = (e) => {
  e.currentTarget.blur();
};

const getLineItemProductId = (item) => item?.id ?? item?.productId ?? '';

const findProductById = (products, productId) =>
  productId ? products.find((p) => p.id === productId) : undefined;

const syncLineItemWithProduct = (item, product) => {
  if (!item || !product) return item;
  return { ...item, name: product.name, color: product.color, size: product.size };
};

const formatProductLineSummary = (item) => {
  if (!item) return '';
  return `${item.name} (${item.color}/${item.size})`;
};

const buildSaleProductNameFromItems = (items) => {
  if (!items?.length) return '';
  if (items.length === 1) return formatProductLineSummary(items[0]);
  return `${formatProductLineSummary(items[0])} 외 ${items.length - 1}건`;
};

const resolveLineItemDisplay = (products, item) => {
  const product = findProductById(products, getLineItemProductId(item));
  return {
    name: product?.name ?? item?.name ?? '(미등록·삭제됨)',
    color: product?.color ?? item?.color ?? '—',
    size: product?.size ?? item?.size ?? '—',
  };
};

const getSaleDisplayProductName = (products, sale) => {
  if (sale?.items?.length) {
    const syncedItems = sale.items.map((item) => {
      const product = findProductById(products, getLineItemProductId(item));
      return product ? syncLineItemWithProduct(item, product) : item;
    });
    return buildSaleProductNameFromItems(syncedItems);
  }
  return sale?.productName ?? '';
};

const getMisongSampleProductName = (products, record) => {
  const product = findProductById(products, record?.productId);
  if (product) return `${product.name} (${product.color}/${product.size})`;
  return record?.productName ?? '';
};

const getRestockProductName = (products, log) => {
  const product = findProductById(products, log?.productId);
  return product?.name ?? log?.productName ?? '';
};

/** 겹받침 자모(ㄳ 등)를 초성 검색용 개별 자모로 분리 — ㄱ+ㅅ 입력이 ㄳ으로 합쳐지지 않게 */
const COMPOUND_JAMO_DECOMPOSE = {
  'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ',
  'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ',
  'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
};

const normalizeChosungSearchInput = (value) => {
  if (!value) return value;
  return [...value].map((ch) => COMPOUND_JAMO_DECOMPOSE[ch] ?? ch).join('');
};

const makeChosungRegex = (searchWord) => {
  if (!searchWord) return new RegExp('');
  const CHOSUNG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  const HANGUL_START = 44032; 
  
  const cleanSearchWord = normalizeChosungSearchInput(searchWord).replace(/\s+/g, '');
  
  const regexStr = cleanSearchWord.split('').map(char => {
    const idx = CHOSUNG.indexOf(char);
    if (idx !== -1) {
      const startChar = String.fromCharCode(HANGUL_START + (idx * 588));
      const endChar = String.fromCharCode(HANGUL_START + (idx * 588) + 587);
      return `[${char}${startChar}-${endChar}]`;
    }
    return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('\\s*');
  
  return new RegExp(regexStr, 'i');
};

/** 연락처: 숫자만 입력 시 자동으로 000-0000-0000 (최대 11자리) */
const formatPhoneHyphens = (input) => {
  const digits = String(input ?? '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const DUPLICATE_CUSTOMER_NAME_MSG = '같은 이름의 거래처가 이미 등록되어 있습니다.';

const isSalesCustomerType = (c) => !c?.type || c.type === '판매처' || c.type === '매출처';

const customerNamesMatchExactly = (a, b) => {
  const x = String(a ?? '').trim();
  const y = String(b ?? '').trim();
  return x.length > 0 && x === y;
};

const findCustomerWithExactName = (customerList, name, excludeId = null) => {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return null;
  return (
    customerList.find(
      (c) => c.id !== excludeId && customerNamesMatchExactly(c.name, trimmed)
    ) || null
  );
};

const CustomerMergeSearchPicker = ({ label, selectedId, excludeId, customers, onSelect, focusRingClass }) => {
  const selected = customers.find((c) => c.id === selectedId);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [listPos, setListPos] = useState(null);
  const wrapRef = useRef(null);
  const anchorRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (selected) {
      setQuery(`${selected.name} (${selected.id})`);
    }
  }, [selectedId, selected?.name, selected?.id]);

  const updateListPosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(320, Math.max(140, preferBelow ? spaceBelow : spaceAbove));
    setListPos({
      left: rect.left,
      width: rect.width,
      maxHeight,
      preferBelow,
      top: preferBelow ? rect.bottom + 4 : rect.top - maxHeight - 4,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setListPos(null);
      return;
    }
    updateListPosition();
    const onReposition = () => updateListPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, query, updateListPosition]);

  useEffect(() => {
    const onDocClick = (e) => {
      const t = e.target;
      if (wrapRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const searchRegex = makeChosungRegex(query);
  const qLower = query.trim().toLowerCase();
  const qDigits = query.replace(/\s+/g, '');

  const filtered = customers
    .filter((c) => c.id !== excludeId)
    .filter((c) => {
      if (!query.trim()) return true;
      return (
        searchRegex.test(c.name) ||
        c.id.toLowerCase().includes(qLower) ||
        (c.phone && c.phone.replace(/\s+/g, '').includes(qDigits))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const pickCustomer = (c) => {
    onSelect(c.id);
    setQuery(`${c.name} (${c.id})`);
    setOpen(false);
  };

  const clearSelection = () => {
    onSelect('');
    setQuery('');
    setOpen(false);
  };

  const dropdownList =
    open && listPos
      ? createPortal(
          <div
            ref={listRef}
            role="listbox"
            className="fixed z-[200] bg-white border border-gray-200 rounded-lg shadow-xl overflow-y-auto overscroll-contain custom-scrollbar"
            style={{
              left: listPos.left,
              width: listPos.width,
              top: listPos.top,
              maxHeight: listPos.maxHeight,
            }}
          >
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-gray-500 text-sm">검색 결과가 없습니다.</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickCustomer(c)}
                  className={`w-full text-left p-3 border-b last:border-0 hover:bg-gray-50 transition-colors ${
                    c.id === selectedId ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className="font-bold text-gray-800 text-sm">{c.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{c.id}</span>
                  {c.phone ? <span className="block text-xs text-gray-400 mt-0.5">{c.phone}</span> : null}
                </button>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-bold text-gray-600 mb-1">{label}</label>
      <div ref={anchorRef} className="relative">
        <Search className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
        <input
          type="text"
          lang="ko"
          style={{ imeMode: 'active' }}
          placeholder="업체명·코드·연락처 검색 (초성 가능)"
          value={query}
          onChange={(e) => {
            setQuery(normalizeChosungSearchInput(e.target.value));
            setOpen(true);
            if (selectedId) onSelect('');
          }}
          onFocus={() => setOpen(true)}
          className={`w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 ${focusRingClass} ${
            selectedId ? 'bg-blue-50 border-blue-300 font-medium' : 'bg-white'
          }`}
        />
        {query && (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            aria-label="선택 지우기"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {dropdownList}
    </div>
  );
};

const MENU_CONFIG = {
  dashboard: { label: '메인화면 (현황)', Icon: Home },
  sales: { label: '판매 / 반품', Icon: ShoppingCart },
  salesReport: { label: '매출 현황', Icon: TrendingUp },
  productStats: { label: '상품 통계', Icon: BarChart },
  salesStats: { label: '매출 통계', Icon: LineChart },
  inventory: { label: '상품 관리', Icon: Package },
  restockHistory: { label: '입고 내역', Icon: Inbox },
  customers: { label: '업체 내역', Icon: Users },
  misong: { label: '미송 / 샘플 내역', Icon: FileText },
  cash: { label: '시재 관리', Icon: Wallet },
  notice: { label: '공지사항', Icon: Megaphone },
  tasksMemo: { label: '할 일 / 메모', Icon: ClipboardList },
};

const STICKY_NOTE_COLORS = ['#fef9c3', '#fce7f3', '#d1fae5', '#dbeafe', '#ffedd5', '#e9d5ff'];

const MENU_ORDER_STORAGE_KEY = 'mainMenuOrder';
const MENU_ORDER_FIRESTORE_ID = 'mainMenuOrder';

const getDefaultMenuOrder = () => Object.keys(MENU_CONFIG);

const normalizeMenuOrder = (saved) => {
  if (!Array.isArray(saved)) return getDefaultMenuOrder();
  const valid = saved.filter((id) => MENU_CONFIG[id]);
  const missing = getDefaultMenuOrder().filter((id) => !valid.includes(id));
  return [...valid, ...missing];
};

const loadMenuOrderFromLocal = () => {
  try {
    const raw = localStorage.getItem(MENU_ORDER_STORAGE_KEY);
    if (!raw) return getDefaultMenuOrder();
    return normalizeMenuOrder(JSON.parse(raw));
  } catch {
    return getDefaultMenuOrder();
  }
};

const menuOrdersEqual = (a, b) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

const DropIndicatorLine = () => (
  <div
    className="pointer-events-none relative z-10 my-0.5 h-1 w-full rounded-full bg-blue-500 shadow-[0_0_0_1px_rgba(255,255,255,0.9),0_0_12px_rgba(37,99,235,0.65)]"
    aria-hidden
  />
);

const MenuOrderDragList = ({ menuOrder, setMenuOrder }) => {
  const [dragFrom, setDragFrom] = useState(null);
  const [insertBeforeK, setInsertBeforeK] = useState(null);
  const listRef = useRef(null);
  const dragFromRef = useRef(null);
  const insertKRef = useRef(null);

  const resetDrag = () => {
    dragFromRef.current = null;
    insertKRef.current = null;
    setDragFrom(null);
    setInsertBeforeK(null);
  };

  const handleDragStart = (e, index) => {
    dragFromRef.current = index;
    insertKRef.current = index;
    setDragFrom(index);
    setInsertBeforeK(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleListDragOverCapture = (e) => {
    if (dragFromRef.current === null || !listRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rows = listRef.current.querySelectorAll('[data-menu-order-row]');
    const y = e.clientY;
    let k = menuOrder.length;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (y < rect.top + rect.height / 2) {
        k = i;
        break;
      }
    }
    if (rows.length) {
      const lastRect = rows[rows.length - 1].getBoundingClientRect();
      if (y >= lastRect.top + lastRect.height / 2) k = menuOrder.length;
    }
    insertKRef.current = k;
    setInsertBeforeK(k);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const from = dragFromRef.current;
    const k = insertKRef.current;
    if (from === null) {
      resetDrag();
      return;
    }
    const next = [...menuOrder];
    const [it] = next.splice(from, 1);
    const f = from < k ? k - 1 : k;
    next.splice(f, 0, it);
    setMenuOrder(next);
    resetDrag();
  };

  const handleDragEnd = () => {
    resetDrag();
  };

  return (
    <div
      ref={listRef}
      className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white"
      onDragOverCapture={handleListDragOverCapture}
      onDrop={handleDrop}
    >
      {menuOrder.filter((id) => MENU_CONFIG[id]).map((menuId, index) => {
        const { label, Icon } = MENU_CONFIG[menuId];
        const isDragging = dragFrom === index;
        return (
          <Fragment key={menuId}>
            {dragFrom !== null && insertBeforeK === index ? <DropIndicatorLine /> : null}
            <div
              data-menu-order-row
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex cursor-grab select-none items-center justify-between bg-gray-50 px-3 py-3.5 transition-[opacity,box-shadow,border-color] active:cursor-grabbing ${
                isDragging ? 'bg-blue-50/70 opacity-45 shadow-inner ring-1 ring-inset ring-blue-200/80' : 'hover:bg-gray-100'
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center">
                <GripVertical className="mr-2 shrink-0 text-gray-400" size={18} aria-hidden />
                <span className="w-10 shrink-0 text-lg font-black text-blue-600">F{index + 1}</span>
                <Icon className="mr-3 shrink-0 text-gray-600" size={20} />
                <span className="truncate font-bold text-gray-800">{label}</span>
              </div>
            </div>
          </Fragment>
        );
      })}
      {dragFrom !== null && insertBeforeK === menuOrder.length ? <DropIndicatorLine /> : null}
    </div>
  );
};

const LoginView = ({ onLogin, showAlert }) => {
  const [id, setId] = useState(localStorage.getItem('savedPosId') || '');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(!!localStorage.getItem('savedPosId'));

  const handleLogin = (e) => {
    e.preventDefault();
    if (id === 'bsharp' && password === '1234qwer!@') {
      if (rememberId) {
        localStorage.setItem('savedPosId', id);
      } else {
        localStorage.removeItem('savedPosId');
      }
      sessionStorage.setItem('pos_logged_in', 'true');
      onLogin();
    } else {
      showAlert('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100 font-sans">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center font-bold text-4xl text-white mb-4 shadow-md">P</div>
          <h1 className="text-2xl font-bold text-gray-900">POS SYSTEM</h1>
          <p className="text-gray-500 text-sm">의류 도매 매장관리 시스템</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">아이디</label>
            <input autoFocus type="text" value={id} onChange={e => setId(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" style={{ imeMode: 'inactive' }} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" required />
          </div>
          <div className="flex items-center pb-2">
            <input 
              type="checkbox" 
              id="rememberId" 
              checked={rememberId} 
              onChange={e => setRememberId(e.target.checked)} 
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" 
            />
            <label htmlFor="rememberId" className="ml-2 text-sm font-medium text-gray-700 cursor-pointer">아이디 기억하기</label>
          </div>
          <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-lg hover:bg-gray-800 transition shadow-md">
            로그인
          </button>
        </form>
      </div>
    </div>
  );
};

export default function WholesalePOS() {
  const [menuHistory, setMenuHistory] = useState(['dashboard']);
  const activeMenu = menuHistory[menuHistory.length - 1] || 'dashboard';

  const [receiptPrintCount, setReceiptPrintCount] = useState(() => {
    const savedCount = localStorage.getItem('receiptPrintCount');
    return savedCount !== null ? parseInt(savedCount, 10) : 2;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('pos_logged_in') === 'true'); 
  const [menuOrder, setMenuOrder] = useState(loadMenuOrderFromLocal);
  const visibleMenuOrder = menuOrder.filter((id) => MENU_CONFIG[id]);
  const menuOrderRemoteReadyRef = useRef(false);
  const menuOrderApplyingRemoteRef = useRef(false);

  const [fbUser, setFbUser] = useState(null);

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [misongList, setMisongList] = useState([]);
  const [sampleList, setSampleList] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [restockHistory, setRestockHistory] = useState([]);
  const [cashLogs, setCashLogs] = useState([]);
  const [notices, setNotices] = useState([]);
  const [todoTasks, setTodoTasks] = useState([]);
  const [stickyMemos, setStickyMemos] = useState([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  
  const [selectedProduct, setSelectedProduct] = useState(null); 
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null); 
  
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [salesCategoryTab, setSalesCategoryTab] = useState('전체');
  
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [focusedCustomerIndex, setFocusedCustomerIndex] = useState(-1);
  
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [inventoryTab, setInventoryTab] = useState('active');
  const [inventorySelectedIds, setInventorySelectedIds] = useState(() => new Set());
  const [addProductForm, setAddProductForm] = useState({ name: '', adminName: '', category: '상의', color: '', size: 'Free', price: '', stock: '', material: '', origin: '', image: '', supplierId: '', date: getTodayStr() });
  
  const [productDetailEditMode, setProductDetailEditMode] = useState(false);
  const [productEditForm, setProductEditForm] = useState({});
  const [productRestockQty, setProductRestockQty] = useState('');
  const [productRestockSupplierId, setProductRestockSupplierId] = useState('');
  const [productRestockDate, setProductRestockDate] = useState(getTodayStr());

  const [restockSearchDate, setRestockSearchDate] = useState(getTodayStr());
  const [restockSearchMonth, setRestockSearchMonth] = useState(getTodayStr().substring(0, 7));
  const [restockSearchQuery, setRestockSearchQuery] = useState('');
  const [restockViewType, setRestockViewType] = useState('daily');
  const [restockEditForm, setRestockEditForm] = useState(null); 

  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerListTab, setCustomerListTab] = useState('전체');
  const [customerSort, setCustomerSort] = useState({ key: 'id', direction: 'asc' });
  
  const [customerDetailEditMode, setCustomerDetailEditMode] = useState(false);
  const [customerEditForm, setCustomerEditForm] = useState({});
  const [addCustomerForm, setAddCustomerForm] = useState({ type: '판매처', name: '', phone: '', bizNum: '', memo: '' });

  const today = getTodayStr();
  const [reportDate, setReportDate] = useState(() => getDefaultTransactionDateStr());
  const [reportMonth, setReportMonth] = useState(() => getDefaultTransactionDateStr().substring(0, 7));
  const [productStatsRangeStart, setProductStatsRangeStart] = useState(() => getFirstDayOfMonthStr(getTodayStr().substring(0, 7)));
  const [productStatsRangeEnd, setProductStatsRangeEnd] = useState(() => getTodayStr());
  const [salesStatsTab, setSalesStatsTab] = useState('daily');
  const [salesStatsRangeStart, setSalesStatsRangeStart] = useState(() =>
    getFirstDayOfMonthStr(getTodayStr().substring(0, 7))
  );
  const [salesStatsRangeEnd, setSalesStatsRangeEnd] = useState(() => getTodayStr());
  const [salesStatsMonthStart, setSalesStatsMonthStart] = useState(() => {
    const y = getTodayStr().substring(0, 4);
    return `${y}-01`;
  });
  const [salesStatsMonthEnd, setSalesStatsMonthEnd] = useState(() => {
    const y = getTodayStr().substring(0, 4);
    return `${y}-12`;
  });
  const [salesStatsYearStart, setSalesStatsYearStart] = useState(() => getTodayStr().substring(0, 4));
  const [salesStatsYearEnd, setSalesStatsYearEnd] = useState(() => getTodayStr().substring(0, 4));
  const [salesReportTab, setSalesReportTab] = useState('daily'); 
  const [salesReportSort, setSalesReportSort] = useState({ key: 'date', direction: 'desc' });
  
  const [saleDetailModal, setSaleDetailModal] = useState(null);
  const [productDetailModalOpen, setProductDetailModalOpen] = useState(false);
  const [customerDetailModalOpen, setCustomerDetailModalOpen] = useState(false);
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [customerMergeModalOpen, setCustomerMergeModalOpen] = useState(false);
  const [customerMergeKeepId, setCustomerMergeKeepId] = useState('');
  const [customerMergeRemoveId, setCustomerMergeRemoveId] = useState('');

  const [misongTab, setMisongTab] = useState('misong');
  const [transactionDate, setTransactionDate] = useState(() => getDefaultTransactionDateStr());

  const [cashForm, setCashForm] = useState({ type: '입금', amount: '', memo: '' });
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '' });
  const [isWritingNotice, setIsWritingNotice] = useState(false);
  const [expandedNoticeId, setExpandedNoticeId] = useState(null);

  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: 'alert', message: '', onConfirm: null });
  const customerSearchRef = useRef(null);

  const [showTopButton, setShowTopButton] = useState(false);
  const inventoryScrollRef = useRef(0);
  const customersScrollRef = useRef(0); 
  const salesScrollRef = useRef(0);
  const mainScrollRef = useRef(null);
  const detailModalScrollRef = useRef(null);

  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [includeDeliveryFee, setIncludeDeliveryFee] = useState(false);

  const [productCustomerPriceSearch, setProductCustomerPriceSearch] = useState('');
  const [customerTierPricePickId, setCustomerTierPricePickId] = useState('');
  const [customerTierPriceInput, setCustomerTierPriceInput] = useState('');
  const [productTierCustomerDropdownOpen, setProductTierCustomerDropdownOpen] = useState(false);

  const handleContainerScroll = (e) => {
    if (e.target.scrollTop > 300) setShowTopButton(true);
    else setShowTopButton(false);
    
    if (activeMenu === 'inventory') inventoryScrollRef.current = e.target.scrollTop;
    else if (activeMenu === 'customers') customersScrollRef.current = e.target.scrollTop;
    else if (activeMenu === 'sales') salesScrollRef.current = e.target.scrollTop;
  };

  const scrollToTop = () => {
    if (mainScrollRef.current) mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openRestockEditModal = (log) => {
    const product = products.find((p) => p.id === log.productId);
    if (!product) {
      showAlert('연결된 상품 정보가 없어 수정할 수 없습니다.');
      return;
    }
    const supplierId = product.supplierId || customers.find((c) => c.name === log.supplier)?.id || '';
    setRestockEditForm({
      logId: log.id,
      productId: log.productId,
      date: log.date,
      time: log.time || '',
      type: log.type || '재입고',
      qty: String(Math.abs(log.qty)),
      supplierId,
      name: product.name,
      adminName: product.adminName || '',
      category: product.category || '상의',
      color: product.color || '',
      size: product.size || 'Free',
      price: product.price,
      material: product.material || '',
      origin: product.origin || '',
    });
  };

  const closeRestockEditModal = () => setRestockEditForm(null);

  const closeProductDetailModal = () => {
    setProductDetailModalOpen(false);
    setProductDetailEditMode(false);
  };
  const closeCustomerDetailModal = () => {
    setCustomerDetailModalOpen(false);
    setCustomerDetailEditMode(false);
  };
  const closeAddProductModal = () => setAddProductModalOpen(false);
  const closeAddCustomerModal = () => setAddCustomerModalOpen(false);

  const openAddProductModal = () => {
    setAddProductForm({ name: '', adminName: '', category: '상의', color: '', size: 'Free', price: '', stock: '', material: '', origin: '', image: '', supplierId: '', date: getTodayStr() });
    setAddProductModalOpen(true);
  };
  const openAddCustomerModal = () => {
    setAddCustomerForm({ type: '판매처', name: '', phone: '', bizNum: '', memo: '' });
    setAddCustomerModalOpen(true);
  };

  const handleRestockEditFormChange = (e) => {
    setRestockEditForm((prev) => (prev ? { ...prev, [e.target.name]: e.target.value } : prev));
  };

  const handleSaveRestockEdit = () => {
    const form = restockEditForm;
    if (!form) return;
    if (!form.name || form.price === '' || form.price === undefined) {
      showAlert('상품명과 단가는 필수 입력 항목입니다.');
      return;
    }
    const oldLog = restockHistory.find((r) => r.id === form.logId);
    const product = products.find((p) => p.id === form.productId);
    if (!oldLog || !product) {
      showAlert('수정할 내역을 찾을 수 없습니다.');
      return;
    }
    const qtyNum = Number(form.qty);
    if (!qtyNum || qtyNum <= 0) {
      showAlert('올바른 수량을 입력해 주세요.');
      return;
    }
    const newSignedQty = form.type === '매입처반품' ? -qtyNum : qtyNum;
    const qtyDiff = newSignedQty - oldLog.qty;
    const supplierName = form.supplierId
      ? customers.find((c) => c.id === form.supplierId)?.name
      : '자체제작/기타';

    const updatedProduct = {
      ...product,
      name: form.name,
      adminName: form.adminName,
      category: form.category,
      color: form.color || 'Free',
      size: form.size || 'Free',
      price: Number(form.price),
      material: form.material,
      origin: form.origin,
      supplierId: form.supplierId || '',
      stock: Math.max(0, product.stock + qtyDiff),
    };

    if (form.type === '초기입고') {
      updatedProduct.initialStock = Math.max(0, (product.initialStock ?? product.stock) + qtyDiff);
    } else if (form.type !== '매입처반품') {
      updatedProduct.restockedQty = Math.max(0, (product.restockedQty || 0) + qtyDiff);
    }

    const updatedLog = {
      ...oldLog,
      date: form.date,
      time: form.time,
      productName: form.name,
      color: updatedProduct.color,
      size: updatedProduct.size,
      supplier: supplierName,
      qty: newSignedQty,
      type: form.type,
    };

    setProducts((prev) => prev.map((p) => (p.id === product.id ? updatedProduct : p)));
    saveItem('products', updatedProduct);
    if (selectedProduct?.id === product.id) setSelectedProduct(updatedProduct);

    setRestockHistory((prev) => prev.map((r) => (r.id === form.logId ? updatedLog : r)));
    saveItem('restockHistory', updatedLog);

    if (
      product.name !== updatedProduct.name ||
      product.color !== updatedProduct.color ||
      product.size !== updatedProduct.size
    ) {
      syncProductLabelsAcrossRecords(product.id, updatedProduct);
    }

    closeRestockEditModal();
    showAlert('입고 내역 및 상품 정보가 수정되었습니다.');
  };

  const syncProductLabelsAcrossRecords = (productId, product) => {
    const misongSampleLabel = `${product.name} (${product.color}/${product.size})`;

    let salesChanged = false;
    const updatedDailySales = dailySales.map((sale) => {
      if (!sale.items?.some((i) => getLineItemProductId(i) === productId)) return sale;
      salesChanged = true;
      const newItems = sale.items.map((item) =>
        getLineItemProductId(item) === productId ? syncLineItemWithProduct(item, product) : item
      );
      const newSale = { ...sale, items: newItems, productName: buildSaleProductNameFromItems(newItems) };
      saveItem('dailySales', newSale);
      return newSale;
    });
    if (salesChanged) setDailySales(updatedDailySales);

    let misongChanged = false;
    const updatedMisong = misongList.map((m) => {
      if (m.productId !== productId) return m;
      misongChanged = true;
      const newM = { ...m, productName: misongSampleLabel };
      saveItem('misong', newM);
      return newM;
    });
    if (misongChanged) setMisongList(updatedMisong);

    let sampleChanged = false;
    const updatedSample = sampleList.map((s) => {
      if (s.productId !== productId) return s;
      sampleChanged = true;
      const newS = { ...s, productName: misongSampleLabel };
      saveItem('samples', newS);
      return newS;
    });
    if (sampleChanged) setSampleList(updatedSample);

    let restockChanged = false;
    const updatedRestock = restockHistory.map((r) => {
      if (r.productId !== productId) return r;
      restockChanged = true;
      const newR = { ...r, productName: product.name, color: product.color, size: product.size };
      saveItem('restockHistory', newR);
      return newR;
    });
    if (restockChanged) setRestockHistory(updatedRestock);
  };

  const navigateTo = (menuId, isMainNav = false) => {
    if (isMainNav) {
      setSalesSearchQuery('');
      setInventorySearchQuery('');
      setCustomerSearchQuery('');
      setRestockSearchQuery('');
      setCustomerSearchTerm('');
      setSelectedCustomer('');
      setCart([]);
      setDiscountAmount(0);
      setIncludeDeliveryFee(false);
      setFocusedCustomerIndex(-1);
      setTransactionDate(getDefaultTransactionDateStr());
      setReportDate(getDefaultTransactionDateStr());
      setReportMonth(getDefaultTransactionDateStr().substring(0, 7));
      setProductStatsRangeStart(getFirstDayOfMonthStr(getTodayStr().substring(0, 7)));
      setProductStatsRangeEnd(getTodayStr());
      setRestockSearchDate(getTodayStr());
      setRestockSearchMonth(getTodayStr().substring(0, 7));
      setRestockViewType('daily');
      setIsCustomerDropdownOpen(false);
      inventoryScrollRef.current = 0;
      customersScrollRef.current = 0;
      salesScrollRef.current = 0;
    }

    setShowTopButton(false);

    setMenuHistory(prev => {
      if (isMainNav) return [menuId];
      if (prev[prev.length - 1] === menuId) return prev;
      return [...prev, menuId];
    });
  };

  useEffect(() => {
    if (!db || !fbUser) return;

    const menuOrderDocRef = doc(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'appSettings',
      MENU_ORDER_FIRESTORE_ID
    );

    return onSnapshot(
      menuOrderDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const remote = normalizeMenuOrder(snapshot.data()?.menuOrder);
          menuOrderApplyingRemoteRef.current = true;
          setMenuOrder((prev) => (menuOrdersEqual(prev, remote) ? prev : remote));
          localStorage.setItem(MENU_ORDER_STORAGE_KEY, JSON.stringify(remote));
          menuOrderApplyingRemoteRef.current = false;
        }
        menuOrderRemoteReadyRef.current = true;
      },
      (err) => {
        console.error('Menu order sync error:', err);
        menuOrderRemoteReadyRef.current = true;
      }
    );
  }, [fbUser]);

  useEffect(() => {
    localStorage.setItem(MENU_ORDER_STORAGE_KEY, JSON.stringify(menuOrder));
    if (menuOrderApplyingRemoteRef.current || !menuOrderRemoteReadyRef.current) return;
    if (!db || !fbUser) return;

    setDoc(
      doc(db, 'artifacts', appId, 'public', 'data', 'appSettings', MENU_ORDER_FIRESTORE_ID),
      {
        id: MENU_ORDER_FIRESTORE_ID,
        menuOrder,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    ).catch(console.error);
  }, [menuOrder, fbUser]);

  const applySalesStatsDefaults = useCallback(
    (tab) => {
      if (tab === 'daily') {
        const mo = getTodayStr().substring(0, 7);
        setSalesStatsRangeStart(getFirstDayOfMonthStr(mo));
        setSalesStatsRangeEnd(getTodayStr());
      } else if (tab === 'monthly') {
        const y = getTodayStr().substring(0, 4);
        setSalesStatsMonthStart(`${y}-01`);
        setSalesStatsMonthEnd(`${y}-12`);
      } else {
        setSalesStatsYearStart(getFirstSaleYearFromDailySales(dailySales));
        setSalesStatsYearEnd(getTodayStr().substring(0, 4));
      }
    },
    [dailySales]
  );

  useEffect(() => {
    if (activeMenu !== 'salesStats') return;
    applySalesStatsDefaults(salesStatsTab);
  }, [activeMenu, salesStatsTab, applySalesStatsDefaults]);

  useEffect(() => {
    if (activeMenu !== 'salesStats' || salesStatsTab !== 'yearly') return;
    setSalesStatsYearStart(getFirstSaleYearFromDailySales(dailySales));
    setSalesStatsYearEnd(getTodayStr().substring(0, 4));
  }, [activeMenu, salesStatsTab, dailySales]);

  // 스크롤 복원 (타이머 딜레이를 주어 렌더링 후 정확히 복구되게 함)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mainScrollRef.current) {
        if (activeMenu === 'inventory') {
          mainScrollRef.current.scrollTop = inventoryScrollRef.current;
        } else if (activeMenu === 'customers') {
          mainScrollRef.current.scrollTop = customersScrollRef.current;
        } else if (activeMenu === 'sales') {
          mainScrollRef.current.scrollTop = salesScrollRef.current;
        } else {
          mainScrollRef.current.scrollTop = 0;
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activeMenu, salesCategoryTab, customerListTab]); 

  useEffect(() => {
    setMenuOrder((prev) => {
      const next = prev.filter((id) => MENU_CONFIG[id]);
      return next.length === prev.length ? prev : next;
    });
  }, []);

  const goBack = () => {
    setMenuHistory(prev => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  };

  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      setMenuHistory(prev => {
        if (prev.length <= 1) return prev;
        return prev.slice(0, -1);
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showAlert = (message, onConfirm = null) => setModalConfig({ isOpen: true, type: 'alert', message, onConfirm });
  const showConfirm = (message, onConfirm = null) => setModalConfig({ isOpen: true, type: 'confirm', message, onConfirm });
  const closeModal = () => setModalConfig({ isOpen: false, type: 'alert', message: '', onConfirm: null });

  const renderModal = () => {
    if (!modalConfig.isOpen) return null;
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-white/40 backdrop-blur-md"
        onClick={closeModal}
      >
        <div
          className="mx-4 w-full max-w-sm transform rounded-xl bg-white p-6 shadow-2xl transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
            {modalConfig.type === 'confirm' ? <AlertCircle className="mr-2 text-blue-500" size={20} /> : <CheckCircle className="mr-2 text-green-500" size={20} />}
            {modalConfig.type === 'confirm' ? '확인' : '알림'}
          </h3>
          <p className="text-gray-600 mb-6 whitespace-pre-wrap text-sm leading-relaxed">
            {modalConfig.message}
          </p>
          <div className="flex justify-end space-x-2">
            {modalConfig.type === 'confirm' && (
              <button 
                onClick={closeModal} 
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition text-sm shadow-sm"
              >
                취소
              </button>
            )}
            <button 
              autoFocus 
              onClick={() => {
                if (modalConfig.onConfirm) modalConfig.onConfirm();
                closeModal();
              }} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition text-sm shadow-sm"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  };

  const saveItem = (colName, item) => {
    if (!db || !fbUser) return;
    const id = item.id || item.date;
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', colName, id), item).catch(console.error);
  };

  const deleteItem = (colName, id) => {
    if (!db || !fbUser) return;
    deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', colName, id)).catch(console.error);
  };

  const customerTotalSales = useMemo(() => {
    const totals = {};
    dailySales.forEach(sale => {
      if (!totals[sale.customerName]) totals[sale.customerName] = 0;
      const amount = (sale.actualPayment ?? 0) + (sale.appliedBalance ?? 0);
      if (sale.type === '판매') {
        totals[sale.customerName] += amount;
      } else {
        totals[sale.customerName] -= amount;
      }
    });
    return totals;
  }, [dailySales]);

  const currentCashBalance = useMemo(() => {
    return cashLogs.reduce((acc, log) => {
      return log.type === '입금' ? acc + log.amount : acc - log.amount;
    }, 0);
  }, [cashLogs]);

  const productStatsTop10 = useMemo(() => {
    const qtyByProductId = {};
    const fallbackLabel = {};
    if (!productStatsRangeStart || !productStatsRangeEnd) {
      return [];
    }
    const rangeFrom =
      productStatsRangeStart <= productStatsRangeEnd ? productStatsRangeStart : productStatsRangeEnd;
    const rangeTo =
      productStatsRangeEnd >= productStatsRangeStart ? productStatsRangeEnd : productStatsRangeStart;
    dailySales.forEach((sale) => {
      if (sale.type !== '판매') return;
      if (!sale.date) return;
      if (sale.date < rangeFrom || sale.date > rangeTo) return;
      const lineItems = sale.items;
      if (!Array.isArray(lineItems)) return;
      lineItems.forEach((item) => {
        const pid = item.id;
        if (!pid) return;
        qtyByProductId[pid] = (qtyByProductId[pid] || 0) + (Number(item.qty) || 0);
        if (!fallbackLabel[pid]) {
          fallbackLabel[pid] = {
            name: item.name != null ? String(item.name) : '',
            color: item.color != null ? String(item.color) : '',
          };
        }
      });
    });
    return Object.entries(qtyByProductId)
      .map(([productId, qty]) => {
        const p = products.find((pr) => pr.id === productId);
        const fb = fallbackLabel[productId] || { name: '', color: '' };
        return {
          productId,
          qty,
          displayName: p?.name || fb.name || '(미등록·삭제됨)',
          displayColor: p?.color || fb.color || '—',
        };
      })
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [dailySales, products, productStatsRangeStart, productStatsRangeEnd]);

  const salesStatsRows = useMemo(() => {
    const bucket = {};

    dailySales.forEach((sale) => {
      if (sale.type !== '판매' && sale.type !== '반품') return;
      if (!sale.date) return;
      const net = getSaleNetAmount(sale);
      let key = '';

      if (salesStatsTab === 'daily') {
        if (!salesStatsRangeStart) return;
        const mo = salesStatsRangeStart.substring(0, 7);
        const monthStart = getFirstDayOfMonthStr(mo);
        const monthEnd = getLastDayOfMonthStr(mo);
        if (sale.date < monthStart || sale.date > monthEnd) return;
        if (isWeekendDateStr(sale.date)) return;
        key = sale.date;
      } else if (salesStatsTab === 'monthly') {
        key = sale.date.substring(0, 7);
        if (!key || key.length < 7) return;
        const ms =
          salesStatsMonthStart <= salesStatsMonthEnd ? salesStatsMonthStart : salesStatsMonthEnd;
        const me =
          salesStatsMonthEnd >= salesStatsMonthStart ? salesStatsMonthEnd : salesStatsMonthStart;
        if (key < ms || key > me) return;
      } else {
        key = sale.date.substring(0, 4);
        if (!key) return;
        const ys = Math.min(Number(salesStatsYearStart), Number(salesStatsYearEnd));
        const ye = Math.max(Number(salesStatsYearStart), Number(salesStatsYearEnd));
        const y = Number(key);
        if (Number.isNaN(y) || y < ys || y > ye) return;
      }

      bucket[key] = (bucket[key] || 0) + net;
    });

    const toRows = (labels) => labels.map((label) => ({ label, netSales: bucket[label] || 0 }));

    if (salesStatsTab === 'daily') {
      if (!salesStatsRangeStart) return [];
      const mo = salesStatsRangeStart.substring(0, 7);
      const monthStart = getFirstDayOfMonthStr(mo);
      const monthEnd = getLastDayOfMonthStr(mo);
      const today = getTodayStr();
      const labels = [];
      let cur = monthStart;
      while (cur <= monthEnd) {
        if (!isWeekendDateStr(cur)) labels.push(cur);
        cur = addDaysToDateStr(cur, 1);
      }
      return labels.map((label) => ({
        label,
        netSales: bucket[label] || 0,
        isFuture: label > today,
      }));
    }

    if (salesStatsTab === 'monthly') {
      const ms =
        salesStatsMonthStart <= salesStatsMonthEnd ? salesStatsMonthStart : salesStatsMonthEnd;
      const me =
        salesStatsMonthEnd >= salesStatsMonthStart ? salesStatsMonthEnd : salesStatsMonthStart;
      const labels = [];
      let cur = ms;
      while (cur <= me) {
        labels.push(cur);
        cur = shiftMonthStr(cur, 1);
      }
      return toRows(labels);
    }

    const ys = Math.min(Number(salesStatsYearStart), Number(salesStatsYearEnd));
    const ye = Math.max(Number(salesStatsYearStart), Number(salesStatsYearEnd));
    if (Number.isNaN(ys) || Number.isNaN(ye)) return [];
    const labels = [];
    for (let y = ys; y <= ye; y += 1) labels.push(String(y));
    return toRows(labels);
  }, [
    dailySales,
    salesStatsTab,
    salesStatsRangeStart,
    salesStatsRangeEnd,
    salesStatsMonthStart,
    salesStatsMonthEnd,
    salesStatsYearStart,
    salesStatsYearEnd,
  ]);

  const handleGoToProductDetail = (p, editMode = false) => {
    setSelectedProduct(p);
    setProductEditForm({
      ...p,
      customerPrices: p.customerPrices && typeof p.customerPrices === 'object' ? { ...p.customerPrices } : {}
    });
    setProductDetailEditMode(editMode);
    setProductCustomerPriceSearch('');
    setCustomerTierPricePickId('');
    setCustomerTierPriceInput('');
    setProductTierCustomerDropdownOpen(false);
    setProductRestockQty('');
    setProductRestockSupplierId('');
    setProductRestockDate(getTodayStr());
    setProductDetailModalOpen(true);
  };

  const handleGoToCustomerDetail = (c, editMode = false) => {
    setSelectedCustomerDetail(c);
    setCustomerEditForm(c);
    setCustomerDetailEditMode(editMode);
    setCustomerDetailModalOpen(true);
  };

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (tokenError) {
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error('Auth error:', e);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => setFbUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db || !fbUser) return;

    const setupSubscription = (colName, setState, sortFn) => {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', colName);
      return onSnapshot(colRef, (snapshot) => {
        const data = [];
        snapshot.forEach(doc => data.push(doc.data()));
        if (sortFn) data.sort(sortFn);
        setState(data);
      }, console.error);
    };

    const unsubs = [
      setupSubscription('products', setProducts, (a,b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })),
      setupSubscription('customers', setCustomers, (a,b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })),
      setupSubscription('misong', setMisongList, (a,b) => b.id.localeCompare(a.id)),
      setupSubscription('samples', setSampleList, (a,b) => b.id.localeCompare(a.id)),
      setupSubscription('dailySales', setDailySales, (a,b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return b.time.localeCompare(a.time);
      }),
      setupSubscription('monthlySales', setMonthlySales, (a,b) => b.date.localeCompare(a.date)),
      setupSubscription('restockHistory', setRestockHistory, (a,b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return b.time.localeCompare(a.time);
      }),
      setupSubscription('cashLogs', setCashLogs, (a,b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return b.time.localeCompare(a.time);
      }),
      setupSubscription('notices', setNotices, (a,b) => b.id.localeCompare(a.id)),
      setupSubscription('todoTasks', setTodoTasks, (a, b) => {
        if (a.done !== b.done) return Number(a.done) - Number(b.done);
        return b.id.localeCompare(a.id);
      }),
      setupSubscription('stickyMemos', setStickyMemos, (a, b) => b.id.localeCompare(a.id))
    ];

    return () => unsubs.forEach(u => u());
  }, [fbUser]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!e || typeof e.key !== 'string') return;

      if (modalConfig.isOpen) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!e.repeat) {
            if (modalConfig.onConfirm) modalConfig.onConfirm();
            closeModal();
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeModal();
        }
        return; 
      }

      if (restockEditForm && e.key === 'Escape') {
        e.preventDefault();
        closeRestockEditModal();
        return;
      }

      if (saleDetailModal && e.key === 'Escape') {
        e.preventDefault();
        setSaleDetailModal(null);
        return;
      }

      if (productDetailModalOpen && e.key === 'Escape') {
        e.preventDefault();
        closeProductDetailModal();
        return;
      }
      if (customerDetailModalOpen && e.key === 'Escape') {
        e.preventDefault();
        closeCustomerDetailModal();
        return;
      }
      if (addProductModalOpen && e.key === 'Escape') {
        e.preventDefault();
        closeAddProductModal();
        return;
      }
      if (addCustomerModalOpen && e.key === 'Escape') {
        e.preventDefault();
        closeAddCustomerModal();
        return;
      }

      const match = e.key.match(/^F(\d+)$/);
      if (match) {
        const fNumber = parseInt(match[1], 10);
        if (fNumber >= 1 && fNumber <= visibleMenuOrder.length) {
          e.preventDefault(); 
          navigateTo(visibleMenuOrder[fNumber - 1], true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalConfig, visibleMenuOrder, saleDetailModal, restockEditForm, productDetailModalOpen, customerDetailModalOpen, addProductModalOpen, addCustomerModalOpen]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const resolveProductUnitPrice = (product, customerId) => {
    if (!product) return 0;
    if (customerId && product.customerPrices && Object.prototype.hasOwnProperty.call(product.customerPrices, customerId)) {
      const n = Number(product.customerPrices[customerId]);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
    return (product.salePrice != null && product.salePrice < product.price) ? product.salePrice : product.price;
  };

  const productUsesCustomerPrice = (product, customerId) => {
    if (!product || !customerId || !product.customerPrices) return false;
    if (!Object.prototype.hasOwnProperty.call(product.customerPrices, customerId)) return false;
    const n = Number(product.customerPrices[customerId]);
    return !Number.isNaN(n) && n >= 0;
  };

  useEffect(() => {
    setCart((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((item) => {
        const p = products.find((pr) => pr.id === item.id);
        if (!p) return item;
        const unit = resolveProductUnitPrice(p, selectedCustomer);
        const uses = productUsesCustomerPrice(p, selectedCustomer);
        return { ...item, price: unit, originalPrice: p.price, usedCustomerPrice: uses };
      });
    });
  }, [selectedCustomer, products]);

  const printReceipt = (receiptData) => {
    if (receiptPrintCount === 0) return;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const now = new Date();
    const printTime = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    const txDate = receiptData.date || now.toLocaleDateString();

    const lineItemCount = receiptData.cart.length;
    const totalQty = receiptData.cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const itemsSectionLabel =
      receiptData.type === '반품' ? '반품내역' : receiptData.type === '샘플' ? '출고내역' : '구매내역';

    let itemsHtml = `
      <div class="items-header">${itemsSectionLabel} <span class="items-count">(총 ${lineItemCount}개 항목)</span></div>
    `;
    receiptData.cart.forEach((item, index) => {
      const itemTotal = item.qty * item.price;
      itemsHtml += `
        <div class="item">
          <div class="item-name"><span class="item-no">${index + 1}.</span> ${item.name} (${item.color}/${item.size})</div>
          <div class="item-calc">
            <span>${item.price.toLocaleString()} x ${item.qty}</span>
            <span>${itemTotal.toLocaleString()}</span>
          </div>
          ${item.misongQty > 0 ? `<div class="misong-notice">* 미송포함: ${item.misongQty}장</div>` : ''}
        </div>
      `;
    });

    let summaryHtml = '';
    if (receiptData.type === '결제') {
      summaryHtml = `
        <div class="summary-line">
          <span>총 상품금액</span>
          <span>${receiptData.cartTotal.toLocaleString()}</span>
        </div>
        ${receiptData.discountAmount > 0 ? `
        <div class="summary-line text-discount">
          <span>할인</span>
          <span>-${receiptData.discountAmount.toLocaleString()}</span>
        </div>` : ''}
        ${receiptData.deliveryFee > 0 ? `
        <div class="summary-line">
          <span>택배비</span>
          <span>+${receiptData.deliveryFee.toLocaleString()}</span>
        </div>` : ''}
        ${receiptData.appliedBalance > 0 ? `
        <div class="summary-line text-discount">
          <span>잔고 차감</span>
          <span>-${receiptData.appliedBalance.toLocaleString()}</span>
        </div>` : ''}
        <div class="divider"></div>
        <div class="summary-line total-line">
          <span>최종 결제액</span>
          <span>${receiptData.actualPayment.toLocaleString()}원 <span class="total-qty">(${totalQty}장)</span></span>
        </div>
      `;
    } else if (receiptData.type === '반품') {
      summaryHtml = `
        <div class="summary-line total-line">
          <span>총 반품액 (잔고적립)</span>
          <span>${receiptData.amountAfterDiscount.toLocaleString()}원 <span class="total-qty">(${totalQty}장)</span></span>
        </div>
      `;
    } else if (receiptData.type === '샘플') {
      summaryHtml = `
        <div class="summary-line total-line">
          <span>샘플 출고</span>
          <span>총 ${totalQty}장 <span class="total-qty-sub">(${lineItemCount}개 항목)</span></span>
        </div>
      `;
    }

    const generateReceiptBody = (receiptTypeLabel) => `
      <div class="receipt">
        <div class="header">
          <img src="logo.png" alt="B#" class="logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div class="logo-text-fallback" style="display:none;">B#</div>
          
          <div class="info-row">
            <div class="info-center">
              <div class="store-address">청평화 2층 가 12호</div>
              <div class="store-contact">
                Tel : 010-7208-8833<br>
                Kakao : bsharp8833<br>
                E-mail : bsharp@kakao.com
              </div>
            </div>
          </div>

          <div class="receipt-title">
            영 수 증 (${receiptData.type})<br>
            <span class="receipt-type">[${receiptTypeLabel}]</span>
          </div>
          <div class="tx-time">거래일자 : ${txDate}</div>
        </div>
        
        <div class="divider-solid"></div>
        <div class="customer-info">거래처 : ${receiptData.customerName}</div>
        <div class="divider-solid"></div>
        
        ${itemsHtml}
        
        <div class="divider"></div>
        
        ${summaryHtml}
        
        <div class="account-box">
          <div class="bank-title">입금계좌 안내</div>
          <div class="bank-num">신한 333 12 268693</div>
          <div class="bank-owner">예금주: 강희창</div>
        </div>
        
        <div class="footer">
          <p>이용해 주셔서 감사합니다.</p>
          ${receiptData.type === '결제' ? '<p>(교환/반품 시 영수증 지참 요망)</p>' : ''}
          <div class="print-time">출력일시 : ${printTime}</div>
        </div>
      </div>
    `;

    let printPagesHtml = `
      <div class="${receiptPrintCount === 2 ? 'page-break' : ''}">
        ${generateReceiptBody('고객용')}
      </div>
    `;
    
    if (receiptPrintCount === 2) {
      printPagesHtml += `
        <div>
          ${generateReceiptBody('매장 보관용')}
        </div>
      `;
    }

    const htmlContent = `
      <html>
      <head>
        <title>영수증</title>
        <style>
          body { 
            font-family: 'Malgun Gothic', 'Dotum', sans-serif; 
            font-size: 12px; color: #000; margin: 0; padding: 10px; width: 280px; 
          }
          .page-break { page-break-after: always; margin-bottom: 20px; }
          .header { text-align: center; margin-bottom: 10px; }
          .logo { max-width: 150px; max-height: 80px; margin: 0 auto 10px; display: block; object-fit: contain; }
          .logo-text-fallback { font-size: 32px; font-weight: 900; margin-bottom: 10px; font-style: italic; color: #000; }
          
          .info-row { display: flex; justify-content: center; align-items: center; margin-bottom: 15px; }
          .info-center { text-align: center; }
          .store-address { font-size: 17px; margin-bottom: 6px; font-weight: 900; color: #000; letter-spacing: -0.02em; }
          .store-contact { font-size: 14px; line-height: 1.55; color: #000; font-weight: 700; }
          
          .receipt-title { font-size: 18px; font-weight: 900; margin: 10px 0 5px; letter-spacing: 2px; line-height: 1.3; color: #000; }
          .receipt-type { font-size: 14px; color: #000; font-weight: 900; }
          .tx-time { font-size: 11px; color: #000; font-weight: 500; margin-top: 5px; }
          .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
          .divider-solid { border-bottom: 1.5px solid #000; margin: 10px 0; }
          .customer-info { font-weight: 900; font-size: 14px; margin: 10px 0; color: #000; }
          .items-header { font-weight: 900; font-size: 13px; margin: 8px 0 10px; color: #000; }
          .items-count { font-size: 12px; font-weight: 900; color: #000; }
          .item { margin-bottom: 10px; }
          .item-name { font-weight: 900; font-size: 12px; margin-bottom: 2px; color: #000; }
          .item-no { display: inline-block; min-width: 1.4em; margin-right: 2px; }
          .total-qty { font-size: 14px; font-weight: 900; }
          .total-qty-sub { font-size: 13px; font-weight: 700; }
          .item-calc { display: flex; justify-content: space-between; font-size: 12px; padding-left: 10px; color: #000; font-weight: 500; }
          .misong-notice { font-size: 11px; padding-left: 10px; margin-top: 2px; font-weight: 900; color: #000; }
          .summary-line { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; font-weight: 900; color: #000; }
          .text-discount { color: #000; font-weight: 500; }
          .total-line { font-size: 17px; font-weight: 900; margin-top: 5px; color: #000; }
          .account-box { border: 2px solid #000; padding: 10px; margin: 15px 0 10px; text-align: center; }
          .account-box .bank-title { font-size: 11px; margin-bottom: 4px; font-weight: 900; color: #000; }
          .account-box .bank-num { font-size: 14px; font-weight: 900; margin-bottom: 4px; letter-spacing: 0.5px; color: #000; }
          .account-box .bank-owner { font-size: 13px; font-weight: 900; color: #000; }
          .footer { text-align: center; margin-top: 15px; font-size: 11px; line-height: 1.5; font-weight: 500; color: #000; }
          .print-time { font-size: 11px; color: #000; font-weight: 500; margin-top: 8px; }
        </style>
      </head>
      <body>
        ${printPagesHtml}
      </body>
      </html>
    `;

    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(htmlContent);
    iframe.contentWindow.document.close();

    setTimeout(() => {
      iframe.contentWindow.print();
      window.focus();
      setTimeout(() => { document.body.removeChild(iframe); }, 1000);
    }, 500);
  };

  const handleToggleEndProduct = (product) => {
    const isCurrentlyEnded = product.isEnded;
    const actionText = isCurrentlyEnded ? '판매재개' : '종료';
    showConfirm(`해당 상품을 [${actionText}] 처리하시겠습니까?\n${!isCurrentlyEnded ? '(종료 시 판매 화면과 재고 알림에서 숨김 처리됩니다.)' : ''}`, () => {
      const updated = { ...product, isEnded: !isCurrentlyEnded };
      setProducts(products.map(p => p.id === product.id ? updated : p));
      saveItem('products', updated);
      showAlert(`[${product.name}] 상품이 ${actionText} 처리되었습니다.`);
    });
  };

  const getNewProductGroupId = () => `grp_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

  const handleDeleteProduct = (id) => {
    showConfirm('해당 상품을 정말 삭제하시겠습니까?\n(삭제 시 관련된 다른 내역에 영향을 줄 수 있습니다)', () => {
      setProducts(products.filter(p => p.id !== id));
      deleteItem('products', id); 
      if (selectedProduct?.id === id) closeProductDetailModal();
    });
  };

  const handleDeleteCustomer = (id) => {
    showConfirm('해당 거래처를 정말 삭제하시겠습니까?\n(삭제 시 기존 거래 내역과 연결이 끊어질 수 있습니다)', () => {
      setCustomers(customers.filter(c => c.id !== id));
      deleteItem('customers', id); 
      if (selectedCustomerDetail?.id === id) closeCustomerDetailModal();
    });
  };

  const renameCustomerNameInAllRecords = (oldName, newName) => {
    if (!oldName || oldName === newName) return;

    setDailySales((prev) => {
      const next = prev.map((sale) => {
        if (sale.customerName !== oldName) return sale;
        const newSale = { ...sale, customerName: newName };
        saveItem('dailySales', newSale);
        return newSale;
      });
      return next;
    });

    setMisongList((prev) => {
      const next = prev.map((m) => {
        if (m.customerName !== oldName) return m;
        const newM = { ...m, customerName: newName };
        saveItem('misong', newM);
        return newM;
      });
      return next;
    });

    setSampleList((prev) => {
      const next = prev.map((s) => {
        if (s.customerName !== oldName) return s;
        const newS = { ...s, customerName: newName };
        saveItem('samples', newS);
        return newS;
      });
      return next;
    });

    setRestockHistory((prev) => {
      const next = prev.map((r) => {
        if (r.supplier !== oldName) return r;
        const newR = { ...r, supplier: newName };
        saveItem('restockHistory', newR);
        return newR;
      });
      return next;
    });
  };

  const applyProductChangesAfterCustomerMerge = (keepId, removeId) => {
    const updatedProducts = products.map((p) => {
      let next = p;
      const prices = p.customerPrices;
      if (prices && Object.prototype.hasOwnProperty.call(prices, removeId)) {
        const nextPrices = { ...prices };
        if (!Object.prototype.hasOwnProperty.call(nextPrices, keepId)) {
          nextPrices[keepId] = nextPrices[removeId];
        }
        delete nextPrices[removeId];
        next = { ...next, customerPrices: nextPrices };
      }
      if (p.supplierId === removeId) {
        next = { ...next, supplierId: keepId };
      }
      if (next !== p) saveItem('products', next);
      return next;
    });
    setProducts(updatedProducts);
  };

  const performMergeCustomers = (keepId, removeId) => {
    const keep = customers.find((c) => c.id === keepId);
    const remove = customers.find((c) => c.id === removeId);
    if (!keep || !remove) {
      showAlert('선택한 거래처를 찾을 수 없습니다.');
      return;
    }
    if (keepId === removeId) {
      showAlert('서로 다른 거래처 두 곳을 선택해주세요.');
      return;
    }
    const keepIsSales = isSalesCustomerType(keep);
    const removeIsSales = isSalesCustomerType(remove);
    if (keepIsSales !== removeIsSales) {
      showAlert('판매처와 매입처는 서로 합칠 수 없습니다. 같은 구분의 거래처만 선택해주세요.');
      return;
    }

    const removeName = remove.name;
    const keepName = keep.name;

    const mergedCustomer = {
      ...keep,
      balance: Number(keep.balance || 0) + Number(remove.balance || 0),
      phone: keep.phone || remove.phone || '',
      bizNum: keep.bizNum || remove.bizNum || '',
      memo: [keep.memo, remove.memo].filter((m) => m && String(m).trim()).join('\n---\n') || '',
    };

    if (removeName !== keepName) {
      renameCustomerNameInAllRecords(removeName, keepName);
    }

    applyProductChangesAfterCustomerMerge(keepId, removeId);

    setCustomers((prev) => {
      const next = prev.filter((c) => c.id !== removeId).map((c) => (c.id === keepId ? mergedCustomer : c));
      return next;
    });
    saveItem('customers', mergedCustomer);
    deleteItem('customers', removeId);

    if (selectedCustomerDetail?.id === removeId) {
      closeCustomerDetailModal();
    } else if (selectedCustomerDetail?.id === keepId) {
      setSelectedCustomerDetail(mergedCustomer);
      setCustomerEditForm(mergedCustomer);
    }

    setCustomerMergeModalOpen(false);
    setCustomerMergeKeepId('');
    setCustomerMergeRemoveId('');

    showAlert(
      `[${removeName}] 거래처를 [${keepName}] (으)로 합쳤습니다.\n판매·반품·미송·샘플·입고·상품 차등단가 내역이 모두 통합되었습니다.`
    );
  };

  const performCancelSale = (saleId) => {
    const sale = dailySales.find(s => s.id === saleId);
    if (!sale) return;

    setDailySales(prev => prev.filter(s => s.id !== saleId));
    deleteItem('dailySales', saleId);

    let updatedProducts = [...products];

    if (sale.items && sale.items.length > 0) {
      sale.items.forEach(item => {
        const pIdx = updatedProducts.findIndex(p => p.id === item.id);
        if (pIdx !== -1) {
          const stockDelta = sale.type === '판매' ? (item.deductedStock ?? item.qty) : -item.qty;
          updatedProducts[pIdx].stock = Math.max(0, updatedProducts[pIdx].stock + stockDelta);
          saveItem('products', updatedProducts[pIdx]);
        }
      });
    }

    if (sale.type === '판매') {
      const relatedMisongs = misongList.filter(m =>
        m.transactionId === saleId ||
        (!m.transactionId && m.date === sale.date && m.customerName === sale.customerName && sale.items?.find(i => i.id === m.productId) && m.id.startsWith('M_AUTO_'))
      );

      let remainingMisongs = [...misongList];
      relatedMisongs.forEach(m => {
        if (m.savedShippedQty > 0) {
          const pIdx = updatedProducts.findIndex(p => p.id === m.productId);
          if (pIdx !== -1) {
            updatedProducts[pIdx].stock += m.savedShippedQty;
            saveItem('products', updatedProducts[pIdx]);
          }
        }
        deleteItem('misong', m.id);
        remainingMisongs = remainingMisongs.filter(rm => rm.id !== m.id);
      });
      setMisongList(remainingMisongs);
    }

    setProducts(updatedProducts);

    setMonthlySales(prev => {
      const nextState = [];
      prev.forEach(m => {
        if (m.date === sale.date) {
          let newM = { ...m };
          if (sale.type === '판매') {
            const saleAmount = Math.abs(sale.actualPayment ?? sale.total) + (sale.appliedBalance || 0);
            newM.sales = Math.max(0, m.sales - saleAmount);
            newM.netSales = m.netSales - saleAmount;
            newM.count = Math.max(0, m.count - 1);
          } else {
            const returnAmount = sale.appliedBalance > 0 ? sale.appliedBalance : Math.abs(sale.actualPayment ?? sale.total);
            newM.returns = Math.max(0, m.returns - returnAmount);
            newM.netSales = m.netSales + returnAmount;
          }

          if (newM.sales === 0 && newM.returns === 0 && newM.count === 0) {
            deleteItem('monthlySales', newM.date);
          } else {
            saveItem('monthlySales', newM);
            nextState.push(newM);
          }
        } else {
          nextState.push(m);
        }
      });
      return nextState;
    });

    setCustomers(prev => prev.map(c => {
      if (c.name === sale.customerName) {
        let newC;
        if (sale.type === '판매') {
          newC = { ...c, balance: c.balance + (sale.appliedBalance || 0) };
        } else {
          const returnAmount = sale.appliedBalance > 0 ? sale.appliedBalance : Math.abs(sale.actualPayment ?? sale.total);
          newC = { ...c, balance: Math.max(0, c.balance - returnAmount) };
        }
        saveItem('customers', newC);
        return newC;
      }
      return c;
    }));

    if (saleDetailModal && saleDetailModal.id === saleId) setSaleDetailModal(null);
    showAlert("거래 내역이 성공적으로 삭제(취소)되었습니다.\n(고객 잔고 및 재고에 해당 내용이 복구 반영되었습니다.)");
  };

  const handleCancelSale = (saleId) => {
    showConfirm("정말 삭제하시겠습니까?\n(관련된 재고, 월별 매출, 고객 잔고가 자동 복구되며, 포함된 미송 내역도 함께 삭제됩니다.)", () => {
      performCancelSale(saleId);
    });
  };

  const handlePartialDelete = (saleId, itemIndex) => {
    const sale = dailySales.find(s => s.id === saleId);
    if (!sale) return;

    const itemToDelete = sale.items[itemIndex];
    const itemToDeleteDisplay = resolveLineItemDisplay(products, itemToDelete);
    
    showConfirm(`[${itemToDeleteDisplay.name}] 상품만 구매 내역에서 부분 취소(삭제)하시겠습니까?\n해당 금액만큼 재고, 매출, 고객 잔고가 복구 수정됩니다.`, () => {
      if (sale.items.length === 1) {
        performCancelSale(saleId);
        return;
      }

      let updatedProducts = [...products];
      const pIdx = updatedProducts.findIndex(p => p.id === itemToDelete.id);
      if (pIdx !== -1) {
        const stockDelta = sale.type === '판매' ? (itemToDelete.deductedStock ?? itemToDelete.qty) : -itemToDelete.qty;
        updatedProducts[pIdx].stock = Math.max(0, updatedProducts[pIdx].stock + stockDelta);
        saveItem('products', updatedProducts[pIdx]); 
      }
      setProducts(updatedProducts);

      if (sale.type === '판매' && itemToDelete.misongQty > 0) {
        const relatedMisong = misongList.find(m => m.transactionId === saleId && m.productId === itemToDelete.id);
        if (relatedMisong) {
          if (relatedMisong.savedShippedQty > 0) {
             const pIdx2 = updatedProducts.findIndex(p => p.id === relatedMisong.productId);
             if (pIdx2 !== -1) {
               updatedProducts[pIdx2].stock += relatedMisong.savedShippedQty;
               saveItem('products', updatedProducts[pIdx2]);
             }
          }
          setMisongList(prev => prev.filter(m => m.id !== relatedMisong.id));
          deleteItem('misong', relatedMisong.id);
        }
      }

      const refundAmount = itemToDelete.price * itemToDelete.qty;
      
      let newSale = { ...sale, items: [...sale.items] };
      newSale.items.splice(itemIndex, 1);
      newSale.items = newSale.items.map((item) => {
        const p = findProductById(products, getLineItemProductId(item));
        return p ? syncLineItemWithProduct(item, p) : item;
      });
      newSale.productName = buildSaleProductNameFromItems(newSale.items);
        
      newSale.qty -= itemToDelete.qty;
      
      let newMonthlySales = [...monthlySales];
      let newCustomers = [...customers];

      if (sale.type === '판매') {
        newSale.total -= refundAmount;
        
        let actualRefund = 0;
        let balanceRefund = 0;
        
        if (newSale.actualPayment >= refundAmount) {
          newSale.actualPayment -= refundAmount;
          actualRefund = refundAmount;
        } else {
          actualRefund = newSale.actualPayment;
          newSale.actualPayment = 0;
          balanceRefund = refundAmount - actualRefund;
          newSale.appliedBalance -= balanceRefund;
        }
        
        if (balanceRefund > 0) {
           newCustomers = newCustomers.map(c => {
             if (c.name === sale.customerName) {
               const newC = { ...c, balance: c.balance + balanceRefund };
               saveItem('customers', newC);
               return newC;
             }
             return c;
           });
           setCustomers(newCustomers);
        }
        
        newMonthlySales = newMonthlySales.map(m => {
          if (m.date === sale.date) {
             const newM = { ...m, sales: m.sales - refundAmount, netSales: m.netSales - refundAmount };
             saveItem('monthlySales', newM);
             return newM;
          }
          return m;
        });
        setMonthlySales(newMonthlySales);
        
      } else {
         newSale.total += refundAmount; 
         newSale.appliedBalance -= refundAmount; 
         
         newCustomers = newCustomers.map(c => {
           if (c.name === sale.customerName) {
             const newC = { ...c, balance: c.balance - refundAmount };
             saveItem('customers', newC);
             return newC;
           }
           return c;
         });
         setCustomers(newCustomers);
         
         newMonthlySales = newMonthlySales.map(m => {
          if (m.date === sale.date) {
             const newM = { ...m, returns: m.returns - refundAmount, netSales: m.netSales + refundAmount };
             saveItem('monthlySales', newM);
             return newM;
          }
          return m;
        });
        setMonthlySales(newMonthlySales);
      }

      setDailySales(prev => prev.map(s => s.id === saleId ? newSale : s));
      saveItem('dailySales', newSale);
      setSaleDetailModal(newSale); 
      
      showAlert('선택한 상품이 내역에서 성공적으로 삭제되고, 관련된 모든 데이터가 수정 반영되었습니다.');
    });
  };

  const handleDeleteMonthlySaleRecord = (dateStr) => {
    showConfirm(`[${dateStr}] 일자의 월별 매출 합계 기록을 완전히 삭제하시겠습니까?\n\n※ 주의: 다른 컴퓨터/오류로 인해 일별 매출에 안보이고 '월별 합계'에만 잡히는 유령 데이터를 지울 때만 사용하세요.`, () => {
      setMonthlySales(prev => prev.filter(m => m.date !== dateStr));
      deleteItem('monthlySales', dateStr);
      showAlert(`[${dateStr}] 일자의 월별 매출 합계가 삭제되었습니다.`);
    });
  };

  const handleLogout = () => {
    showConfirm('로그아웃 하시겠습니까?', () => {
      sessionStorage.removeItem('pos_logged_in');
      setIsAuthenticated(false);
      navigateTo('dashboard', true); 
    });
  };

  if (!isAuthenticated) {
    return (
      <>
        <LoginView onLogin={() => setIsAuthenticated(true)} showAlert={showAlert} />
        {renderModal()}
      </>
    );
  }

  const renderCalendar = (monthStr, dataMap, onDayClick) => {
    const [year, month] = monthStr.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const weeks = [];
    let currentWeek = Array(firstDay).fill(null);
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      currentWeek.push({ day: d, dateStr });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while(currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 overflow-x-auto">
        <div className="min-w-[700px] grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
            <div key={day} className={`bg-gray-50 p-2 text-center text-sm font-bold ${idx===0 ? 'text-red-500' : idx===6 ? 'text-blue-500' : 'text-gray-700'}`}>{day}</div>
          ))}
          {weeks.map((week, wIdx) => 
            week.map((dayObj, dIdx) => {
              if (!dayObj) return <div key={`empty-${wIdx}-${dIdx}`} className="bg-white p-2 min-h-[110px]"></div>;
              const { day, dateStr } = dayObj;
              const isToday = dateStr === getTodayStr();
              const cellData = dataMap[dateStr];
              
              return (
                <div 
                  key={dateStr} 
                  onClick={() => onDayClick(dateStr)}
                  className={`bg-white p-2 min-h-[110px] cursor-pointer hover:bg-blue-50 transition-colors border-t border-gray-100 flex flex-col ${isToday ? 'ring-2 ring-inset ring-blue-500 bg-blue-50/30' : ''}`}
                >
                  <div className={`text-sm font-bold mb-1 ${dIdx===0 ? 'text-red-500' : dIdx===6 ? 'text-blue-500' : 'text-gray-700'}`}>
                    {day}
                  </div>
                  {cellData && (
                     <div className="flex flex-col gap-1.5 mt-auto mb-1 text-right text-sm">
                       {cellData.content}
                     </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderSettingsView = () => {
    const handleReceiptCountChange = (count) => {
      setReceiptPrintCount(count);
      localStorage.setItem('receiptPrintCount', count.toString());
    };

    return (
      <div className="p-6 h-full overflow-y-auto" onScroll={handleContainerScroll} ref={mainScrollRef}>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">환경 설정</h2>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><Printer className="mr-2" size={20}/> 영수증 출력 설정</h3>
          
          <div className="flex items-center space-x-6 mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <span className="text-sm font-bold text-gray-700 w-24">기본 출력 매수</span>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="radio" name="receiptCount" value={0} 
                checked={receiptPrintCount === 0} 
                onChange={() => handleReceiptCountChange(0)} 
                className="text-blue-600 focus:ring-blue-500 w-4 h-4" 
              />
              <span className="text-sm font-medium text-gray-800">출력 안 함</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="radio" name="receiptCount" value={1} 
                checked={receiptPrintCount === 1} 
                onChange={() => handleReceiptCountChange(1)} 
                className="text-blue-600 focus:ring-blue-500 w-4 h-4" 
              />
              <span className="text-sm font-medium text-gray-800">1장 (고객용만)</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="radio" name="receiptCount" value={2} 
                checked={receiptPrintCount === 2} 
                onChange={() => handleReceiptCountChange(2)} 
                className="text-blue-600 focus:ring-blue-500 w-4 h-4" 
              />
              <span className="text-sm font-medium text-gray-800">2장 (고객용 + 보관용)</span>
            </label>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed">
            크롬(Chrome) 브라우저 자동 인쇄(Kiosk Printing) 사용 시, 결제 버튼을 누르면 위에서 설정하신 매수만큼 영수증이 자동으로 인쇄됩니다.<br/><br/>
            [프린터 권장 설정]<br/>
            - 용지 크기: <b>80mm x 297mm</b> (또는 Roll Paper) 선택<br/>
            - 여백: <b>최소</b> 또는 <b>없음</b>
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          <h3 className="text-lg font-bold text-gray-800 mb-4">메인 메뉴 순서 변경</h3>
          <p className="text-sm text-gray-500 mb-1">
            항목을 <b className="text-gray-800">드래그하여 놓으면</b> 순서가 바뀝니다. 드래그 중 <b className="text-blue-600">파란 선</b>은 놓았을 때 메뉴가 들어갈 위치를 미리 보여 줍니다.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            순서에 따라 키보드 최상단 <b className="text-blue-600">F1 ~ F12</b> 단축키가 자동 할당됩니다. 변경 내용은 서버에 저장되어 다른 PC·브라우저에서도 동일하게 적용됩니다.
          </p>
          <MenuOrderDragList menuOrder={menuOrder} setMenuOrder={setMenuOrder} />
        </div>
      </div>
    );
  };

  const renderDashboardView = () => {
    const displayDate = getDefaultTransactionDateStr();
    const todaySalesList = dailySales.filter(sale => sale.date === displayDate);
    
    const todayNetSales = todaySalesList.reduce((sum, sale) => {
      if (sale.type === '판매') {
        return sum + (sale.actualPayment ?? 0) + (sale.appliedBalance || 0);
      } else {
        const returnAmt = (sale.actualPayment ?? 0) + (sale.appliedBalance || 0);
        return sum - returnAmt;
      }
    }, 0);
    const todaySalesCount = todaySalesList.length;
    const totalBalance = customers.reduce((sum, c) => sum + c.balance, 0);
    const pendingMisongCount = misongList.filter(m => m.savedShippedQty < m.qty).length;
    const recentSales = dailySales.filter(sale => sale.date === displayDate).slice(0, 5);

    return (
      <div className="p-6 pb-28 space-y-6 overflow-y-auto" onScroll={handleContainerScroll} ref={mainScrollRef}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">금일 영업 현황 (메인화면)</h2>
          <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100" title="22시 이후는 익일 매출일자 기준">매출일: {displayDate}</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><DollarSign size={24} /></div>
            <div><p className="text-sm text-gray-500 font-medium">오늘 순매출</p><p className="text-2xl font-bold text-gray-800">₩ {todayNetSales.toLocaleString()}</p></div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-lg"><CheckCircle size={24} /></div>
            <div><p className="text-sm text-gray-500 font-medium">오늘 거래건수</p><p className="text-2xl font-bold text-gray-800">{todaySalesCount} 건</p></div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg"><Users size={24} /></div>
            <div><p className="text-sm text-gray-500 font-medium">전체 고객 잔고</p><p className="text-2xl font-bold text-indigo-600">₩ {totalBalance.toLocaleString()}</p></div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-lg"><Package size={24} /></div>
            <div><p className="text-sm text-gray-500 font-medium">미송 대기건수</p><p className="text-2xl font-bold text-gray-800">{pendingMisongCount} 건</p></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><FileText className="mr-2" size={20}/> 최근 판매 내역</h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600 text-sm">
                  <th className="p-3">시간</th><th className="p-3">거래처</th><th className="p-3">품목수</th><th className="p-3">순매출액</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map(sale => (
                  <tr key={sale.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm">{sale.time}</td>
                    <td 
                      className="p-3 text-sm font-bold cursor-pointer hover:text-blue-600 hover:underline"
                      onClick={() => {
                        const cust = customers.find(c => c.name === sale.customerName);
                        if(cust) handleGoToCustomerDetail(cust);
                      }}
                    >
                      {sale.customerName}
                    </td>
                    <td className="p-3 text-sm">{sale.qty}장</td>
                    <td className={`p-3 text-sm font-bold ${sale.type === '반품' ? 'text-gray-500' : 'text-gray-800'}`}>
                      {sale.type === '반품' && sale.actualPayment === 0 ? <span className="text-[10px] text-purple-500 font-normal mr-1">예치금</span> : null}
                      ₩ {Math.abs((sale.actualPayment ?? 0) + (sale.appliedBalance ?? 0)).toLocaleString()} {sale.type === '반품' && sale.actualPayment !== 0 && '(반품)'}
                    </td>
                  </tr>
                ))}
                {recentSales.length === 0 && (<tr><td colSpan="4" className="p-4 text-center text-gray-500 text-sm">해당 매출일의 판매 내역이 없습니다.</td></tr>)}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><AlertCircle className="mr-2" size={20}/> 재고 부족 알림</h3>
            <div className="max-h-60 overflow-y-auto pr-2">
              <ul className="space-y-3">
                {products.filter(p => p.stock < 10 && !p.isEnded).map(p => (
                  <li key={p.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition" onClick={() => handleGoToProductDetail(p)}>
                    <div>
                      <p className="font-bold text-gray-800 hover:text-blue-600">{p.name}</p>
                      <p className="text-sm text-gray-500">{p.color} / {p.size}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold mr-2">{p.stock === 0 ? '품절' : '임박'}</span>
                      <span className="font-bold text-gray-800">{p.stock} 장</span>
                    </div>
                  </li>
                ))}
                {products.filter(p => p.stock < 10 && !p.isEnded).length === 0 && (
                  <li className="p-4 text-center text-gray-500 text-sm">재고가 부족한 상품이 없습니다.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleAddToCart = (product) => {
    if (!selectedCustomer) {
      showAlert('거래처를 먼저 선택해주세요.');
      return;
    }
    const savedTop = mainScrollRef.current?.scrollTop ?? 0;
    const activePrice = resolveProductUnitPrice(product, selectedCustomer);
    const usesTier = productUsesCustomerPrice(product, selectedCustomer);
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, price: activePrice, originalPrice: product.price, qty: 1, usedCustomerPrice: usesTier }]);
    }
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        const el = mainScrollRef.current;
        if (el) {
          el.scrollTop = savedTop;
          salesScrollRef.current = savedTop;
        }
      });
    });
  };

  const updateCartQty = (id, delta) => {
    const currentScroll = mainScrollRef.current?.scrollTop;
    setCart(cart.map(item => item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
    setTimeout(() => {
      if (mainScrollRef.current && currentScroll !== undefined) {
        mainScrollRef.current.scrollTop = currentScroll;
      }
    }, 0);
  };

  const removeCartItem = (id) => {
    const currentScroll = mainScrollRef.current?.scrollTop;
    setCart(cart.filter(item => item.id !== id));
    setTimeout(() => {
      if (mainScrollRef.current && currentScroll !== undefined) {
        mainScrollRef.current.scrollTop = currentScroll;
      }
    }, 0);
  };

  const clearSalesCustomerAndCart = () => {
    setCustomerSearchTerm('');
    setSelectedCustomer('');
    setFocusedCustomerIndex(-1);
    setIsCustomerDropdownOpen(false);
    setCart([]);
    setIncludeDeliveryFee(false);
  };

  const handleTransaction = (type) => {
    if (!selectedCustomer) { showAlert("거래처를 선택해주세요."); return; }
    if (cart.length === 0) { showAlert("상품을 추가해주세요."); return; }

    const customerInfo = customers.find(c => c.id === selectedCustomer);
    const customerName = customerInfo?.name || '알수없음';
    
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    
    const dateStr = transactionDate;
    const transactionId = `TR_${Date.now()}`;

    const deliveryFee = type === '결제' && includeDeliveryFee ? DELIVERY_FEE : 0;
    const amountAfterDiscount = cartTotal - discountAmount + deliveryFee;

    let appliedBalance = 0;
    let actualPayment = 0;

    let newCustomers = [...customers];
    const customerIdx = newCustomers.findIndex(c => c.id === selectedCustomer);

    if (type === '결제') {
      const availableBalance = customerInfo ? Math.max(0, customerInfo.balance) : 0;
      appliedBalance = Math.min(availableBalance, amountAfterDiscount);
      actualPayment = amountAfterDiscount - appliedBalance;
      if (customerIdx !== -1) {
        newCustomers[customerIdx].balance -= appliedBalance;
        saveItem('customers', newCustomers[customerIdx]); 
      }
    } else if (type === '반품') {
      actualPayment = 0; 
      appliedBalance = amountAfterDiscount; 
      if (customerIdx !== -1) {
        newCustomers[customerIdx].balance += amountAfterDiscount; 
        saveItem('customers', newCustomers[customerIdx]); 
      }
    }

    let updatedProducts = [...products];
    let newMisongList = [...misongList];
    let newSampleList = [...sampleList];
    
    let cartWithDetails = cart.map(item => {
      const { image, ...essentialData } = item;
      return essentialData;
    });

    cartWithDetails.forEach((item, index) => {
      const productIndex = updatedProducts.findIndex(p => p.id === item.id);
      let currentStock = updatedProducts[productIndex]?.stock || 0;
      let misongQty = 0;

      if (type === '결제') {
        if (item.qty > currentStock) {
          misongQty = item.qty - currentStock;
        }
      }

      let actualDeducted = 0;
      if (type === '결제' || type === '샘플') {
        actualDeducted = Math.min(currentStock, item.qty);
        currentStock = Math.max(0, currentStock - item.qty);
        if (productIndex !== -1) updatedProducts[productIndex].stock = currentStock;
      } else if (type === '반품') {
        currentStock += item.qty;
        if (productIndex !== -1) updatedProducts[productIndex].stock = currentStock;
      }
      
      item.deductedStock = actualDeducted;
      item.misongQty = misongQty;
      
      if (type === '샘플') {
        const newSample = {
          id: `SMP_NEW_${Date.now()}_${index}`,
          date: dateStr,
          customerName: customerName,
          productId: item.id,
          productName: `${item.name} (${item.color}/${item.size})`,
          qty: item.qty,
          returnedQty: 0,
          savedReturnedQty: 0
        };
        newSampleList.unshift(newSample);
        saveItem('samples', newSample); 
      }

      if (type === '결제' && misongQty > 0) {
        const newMisong = {
          id: `M_AUTO_${Date.now()}_${index}`,
          date: dateStr,
          customerName: customerName,
          productId: item.id,
          productName: `${item.name} (${item.color}/${item.size})`,
          qty: misongQty,
          shippedQty: 0,
          savedShippedQty: 0,
          transactionId: transactionId 
        };
        newMisongList.unshift(newMisong);
        saveItem('misong', newMisong); 
      }
    });

    cart.forEach(item => {
      const p = updatedProducts.find(prod => prod.id === item.id);
      if (p) saveItem('products', p);
    });

    let newDailySales = [...dailySales];
    if (type === '결제' || type === '반품') {
      const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
      const productNameStr = cart.length === 1 
        ? `${cart[0].name} (${cart[0].color}/${cart[0].size})` 
        : `${cart[0].name} 외 ${cart.length - 1}건`;

      const newSaleEntry = {
        id: transactionId,
        date: dateStr,
        time: timeStr,
        items: cartWithDetails,
        productName: productNameStr,
        qty: totalQty,
        total: type === '결제' ? cartTotal : -cartTotal,
        deliveryFee: type === '결제' ? deliveryFee : 0,
        actualPayment: type === '결제' ? actualPayment : 0,
        appliedBalance: type === '결제' ? appliedBalance : amountAfterDiscount,
        customerName: customerName,
        type: type === '결제' ? '판매' : '반품'
      };
      newDailySales.unshift(newSaleEntry);
      saveItem('dailySales', newSaleEntry); 
    }

    setProducts(updatedProducts);
    setCustomers(newCustomers);

    if (type === '결제' || type === '반품') {
      setDailySales(newDailySales);
      let newMonthlySales = [...monthlySales];
      let mIndex = newMonthlySales.findIndex(m => m.date === dateStr);
      if (mIndex === -1) {
        newMonthlySales.unshift({ date: dateStr, sales: 0, returns: 0, netSales: 0, count: 0 });
        mIndex = 0;
      }
      if (type === '결제') {
        newMonthlySales[mIndex].sales += amountAfterDiscount;
        newMonthlySales[mIndex].netSales += amountAfterDiscount;
        newMonthlySales[mIndex].count += 1;
      } else if (type === '반품') {
        newMonthlySales[mIndex].returns += amountAfterDiscount;
        newMonthlySales[mIndex].netSales -= amountAfterDiscount;
      }
      saveItem('monthlySales', newMonthlySales[mIndex]); 
      setMonthlySales(newMonthlySales);
    }
    
    setMisongList(newMisongList);
    setSampleList(newSampleList);

    const receiptData = {
      type,
      customerName,
      cart: cartWithDetails,
      cartTotal,
      discountAmount,
      deliveryFee,
      appliedBalance,
      actualPayment,
      amountAfterDiscount,
      date: dateStr,
      time: timeStr
    };
    printReceipt(receiptData);

    setCart([]);
    setDiscountAmount(0);
    setIncludeDeliveryFee(false);
    setSelectedCustomer('');
    setCustomerSearchTerm(''); 
    setFocusedCustomerIndex(-1);
    setSalesSearchQuery('');
    setTransactionDate(getDefaultTransactionDateStr());
  };

  const renderSalesView = () => {
    const CATEGORIES = ['전체', '상의', '하의', '세트', '아우터', '기타'];

    const productSalesRegex = makeChosungRegex(salesSearchQuery);
    const filteredProductsForSales = products.filter(p => {
      if (p.isEnded) return false; 
      const matchCategory = salesCategoryTab === '전체' || p.category === salesCategoryTab || (!p.category && salesCategoryTab === '상의');
      const matchSearch = productSalesRegex.test(p.name) || 
        (p.adminName && productSalesRegex.test(p.adminName)) ||
        (p.color && productSalesRegex.test(p.color));
      return matchCategory && matchSearch;
    });

    const deliveryFeePreview = includeDeliveryFee ? DELIVERY_FEE : 0;
    const amountAfterDiscountPreview = cartTotal - discountAmount + deliveryFeePreview;
    const customerInfo = customers.find(c => c.id === selectedCustomer);
    const availableBalance = customerInfo ? Math.max(0, customerInfo.balance) : 0;
    const usedBalancePreview = Math.max(0, Math.min(availableBalance, amountAfterDiscountPreview));
    const finalPaymentPreview = Math.max(0, amountAfterDiscountPreview - usedBalancePreview);

    const customerRegex = makeChosungRegex(customerSearchTerm);
    const filteredSalesCustomers = customers.filter(c => 
      (!c.type || c.type === '판매처' || c.type === '매출처') &&
      (customerRegex.test(c.name) || (c.phone && c.phone.replace(/\s+/g,'').includes(customerSearchTerm.replace(/\s+/g,''))))
    );

    const selectCustomer = (c) => {
      setSelectedCustomer(c.id);
      setCustomerSearchTerm(c.name);
      setIsCustomerDropdownOpen(false);
      setFocusedCustomerIndex(-1);
    };

    const handleCustomerSearchKeyDown = (e) => {
      if (!isCustomerDropdownOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedCustomerIndex(prev => prev < filteredSalesCustomers.length - 1 ? prev + 1 : prev);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedCustomerIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredSalesCustomers.length === 1) {
          selectCustomer(filteredSalesCustomers[0]);
        } else if (focusedCustomerIndex >= 0 && focusedCustomerIndex < filteredSalesCustomers.length) {
          selectCustomer(filteredSalesCustomers[focusedCustomerIndex]);
        }
      } else if (e.key === 'Escape') {
        setIsCustomerDropdownOpen(false);
      }
    };

    return (
      <div className="flex h-full min-h-0 flex-col bg-gray-100 md:flex-row">
        <div className="flex min-h-0 w-full shrink-0 flex-col border-r border-gray-200 bg-white shadow-lg md:w-1/3 z-20">
          <div className="p-3 bg-gray-50 border-b space-y-3 shrink-0">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-800">판매 일자</h2>
              <div className="flex items-center space-x-2">
                <input 
                  type="date" 
                  value={transactionDate} 
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="p-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
                />
                <button type="button" onClick={() => setTransactionDate(getDefaultTransactionDateStr())} className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded text-xs font-bold hover:bg-blue-100 transition" title="22시 이후는 익일로 맞춤">오늘</button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50 transition">
              <input
                type="checkbox"
                checked={includeDeliveryFee}
                onChange={(e) => setIncludeDeliveryFee(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Truck size={16} className="shrink-0 text-gray-600" aria-hidden />
              <span className="text-xs font-bold text-gray-700">택배비</span>
              <span className="text-[10px] text-gray-500">(+{DELIVERY_FEE.toLocaleString()}원)</span>
            </label>
            
            <div className="relative space-y-3" ref={customerSearchRef}>
              <h2 className="text-xs font-bold text-gray-800">거래처 검색 (선택)</h2>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  type="text"
                  lang="ko"
                  style={{ imeMode: 'active' }}
                  placeholder="상호명 또는 연락처 (초성검색 가능)"
                  value={customerSearchTerm}
                  onChange={e => {
                    const next = normalizeChosungSearchInput(e.target.value);
                    setCustomerSearchTerm(next);
                    setIsCustomerDropdownOpen(true);
                    setFocusedCustomerIndex(-1);
                    if (selectedCustomer) {
                      setSelectedCustomer('');
                      setCart([]);
                      setIncludeDeliveryFee(false);
                    }
                  }}
                  onFocus={() => setIsCustomerDropdownOpen(true)}
                  onKeyDown={handleCustomerSearchKeyDown}
                  className={`w-full pl-9 pr-9 py-1.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium ${selectedCustomer ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}
                />
                {customerSearchTerm && (
                  <button 
                    type="button"
                    onClick={clearSalesCustomerAndCart}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
              {isCustomerDropdownOpen && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredSalesCustomers.map((c, idx) => (
                    <div 
                      key={c.id} 
                      onClick={() => selectCustomer(c)}
                      onMouseEnter={() => setFocusedCustomerIndex(idx)}
                      className={`p-3 cursor-pointer border-b last:border-0 flex justify-between items-center transition-colors ${focusedCustomerIndex === idx ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
                    >
                      <span className={`font-bold ${focusedCustomerIndex === idx ? 'text-blue-800' : 'text-gray-800'}`}>{c.name}</span>
                      <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">보유: ₩{c.balance.toLocaleString()}</span>
                    </div>
                  ))}
                  {filteredSalesCustomers.length === 0 && (
                    <div className="p-3 text-center text-gray-500 text-sm">검색된 거래처가 없습니다.</div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
            {cart.length === 0 ? (
              <div className="flex min-h-[6rem] items-center justify-center text-gray-400 text-xs">우측에서 상품을 선택하세요.</div>
            ) : (
              cart.map(item => {
                const pInfo = products.find(p => p.id === item.id);
                const currentStock = pInfo ? pInfo.stock : 0;
                const misongQty = Math.max(0, item.qty - currentStock);
                const remainingStock = Math.max(0, currentStock - item.qty);
                
                return (
                  <div key={item.id} className="relative rounded-md border border-gray-200 bg-white p-2 pr-7">
                    <button type="button" onClick={() => removeCartItem(item.id)} className="absolute top-1 right-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                    <div className="flex flex-wrap items-center gap-0.5 leading-tight mb-0.5">
                      <p className="text-xs font-bold text-gray-800 mr-1">{item.name}</p>
                      {item.usedCustomerPrice && <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1 py-px rounded font-bold">거래처단가</span>}
                      {!item.usedCustomerPrice && item.originalPrice > item.price && <span className="bg-red-100 text-red-600 text-[9px] px-1 py-px rounded font-bold">세일</span>}
                      {misongQty > 0 && <span className="bg-orange-100 text-orange-600 text-[9px] px-1 py-px rounded font-bold border border-orange-200">미송{misongQty}</span>}
                    </div>
                    <div className="flex justify-between items-center gap-1 mb-1 text-[10px] text-gray-500">
                      <span className="truncate">{item.color}/{item.size} · ₩{item.price.toLocaleString()}</span>
                      <span className="shrink-0 font-bold text-blue-600">재고{remainingStock}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center rounded border border-gray-200 text-xs">
                        <button type="button" onClick={() => updateCartQty(item.id, -1)} className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 leading-none">−</button>
                        <span className="min-w-[1.75rem] px-1 py-0.5 text-center font-bold tabular-nums">{item.qty}</span>
                        <button type="button" onClick={() => updateCartQty(item.id, 1)} className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 leading-none">+</button>
                      </div>
                      <span className="text-xs font-bold text-gray-800 tabular-nums">₩{(item.price * item.qty).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="shrink-0 p-3 bg-gray-800 text-white rounded-t-lg">
            <div className="flex justify-between mb-1 text-gray-300 text-sm">
              <span className="font-bold">총 상품 금액</span>
              <span className="font-bold">₩ {cartTotal.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between items-center mb-2 bg-gray-700 px-2 py-1.5 rounded-md border border-gray-600">
              <span className="text-sm font-bold text-gray-200">추가 할인 금액</span>
              <div className="flex items-center text-sm">
                <span className="mr-1 text-red-400 font-bold">- ₩</span>
                <input 
                  type="number" 
                  value={discountAmount === 0 ? '' : discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  onWheel={preventMoneyInputWheel}
                  className="input-money-no-spin w-[5.5rem] px-1.5 py-1 text-right text-sm text-red-500 font-bold rounded outline-none focus:ring-2 focus:ring-red-400 bg-white"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex justify-between mb-2 text-blue-300 text-sm">
              <span className="font-bold">고객 잔고 차감</span>
              <span className="font-bold">- ₩ {usedBalancePreview.toLocaleString()}</span>
            </div>
            <div className={`flex justify-between mb-2 text-sm ${includeDeliveryFee ? 'text-amber-200' : 'text-gray-500'}`}>
              <span className="flex items-center gap-1 font-bold">
                <Truck size={12} className="shrink-0" aria-hidden />
                택배비
              </span>
              <span className="font-bold">+ ₩ {deliveryFeePreview.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-2 border-t border-gray-600 pt-2 text-sm">
              <span className="font-bold">최종 결제 금액</span>
              <span className="font-bold text-green-400">₩ {finalPaymentPreview.toLocaleString()}</span>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => handleTransaction('샘플')} className="bg-purple-500 hover:bg-purple-400 py-2 rounded-md font-bold transition text-sm text-white flex justify-center items-center"><Printer size={14} className="mr-1"/> 샘플 출고</button>
                <button onClick={() => handleTransaction('반품')} className="bg-red-500 hover:bg-red-400 py-2 rounded-md font-bold transition text-sm text-white flex justify-center items-center"><Printer size={14} className="mr-1"/> 반품 처리</button>
              </div>
              <button onClick={() => handleTransaction('결제')} className="w-full bg-blue-600 hover:bg-blue-500 py-2.5 rounded-md font-bold transition text-base text-white shadow-md flex justify-center items-center"><Printer size={18} className="mr-1.5"/> 결제 (판매)</button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-gray-100 md:w-2/3">
          <div className="shrink-0 bg-gray-100 px-6 pb-4 pt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">상품 목록</h2>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input 
                  type="text" 
                  lang="ko"
                  style={{ imeMode: 'active' }}
                  placeholder="상품명, 초성 검색..." 
                  value={salesSearchQuery}
                  onChange={(e) => setSalesSearchQuery(normalizeChosungSearchInput(e.target.value))}
                  className="w-72 rounded-full border py-2 pl-10 pr-10 shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-blue-500" 
                />
                {salesSearchQuery && (
                  <button type="button" onClick={() => setSalesSearchQuery('')} className="absolute right-4 top-2.5 text-gray-400 hover:text-gray-600">
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex w-max flex-wrap gap-1 rounded-lg bg-gray-200 p-1">
              {CATEGORIES.map(cat => (
                <button 
                  type="button"
                  key={cat}
                  onClick={() => setSalesCategoryTab(cat)} 
                  className={`rounded-md px-4 py-1.5 text-sm font-bold transition ${salesCategoryTab === cat ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-28 z-0"
            onScroll={handleContainerScroll}
            ref={mainScrollRef}
          >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProductsForSales.map(product => {
              const displayUnit = resolveProductUnitPrice(product, selectedCustomer);
              const tierForCustomer = productUsesCustomerPrice(product, selectedCustomer);
              const hasSale = product.salePrice && product.salePrice < product.price;
              const discountRate = hasSale ? Math.round((1 - product.salePrice / product.price) * 100) : 0;
              
              return (
                <div 
                  key={product.id} 
                  onPointerDown={(e) => {
                    if (!e.isPrimary) return;
                    if (e.pointerType === 'mouse' && e.button !== 0) return;
                    e.preventDefault();
                    handleAddToCart(product);
                  }}
                  className={`bg-white p-4 rounded-xl shadow-sm border border-gray-200 transition group relative overflow-hidden cursor-pointer hover:border-blue-500 hover:shadow-md select-none touch-manipulation ${
                    product.stock === 0 ? 'opacity-60 bg-gray-50' : ''
                  }`}
                >
                  {tierForCustomer && (
                    <div className="absolute top-0 left-0 bg-indigo-600 text-white text-[11px] font-bold px-2 py-1 rounded-br-lg z-10">거래처 단가</div>
                  )}
                  {!tierForCustomer && hasSale && <div className="absolute top-0 left-0 bg-red-600 text-white text-[11px] font-bold px-2 py-1 rounded-br-lg z-10 flex items-center"><Tag size={12} className="mr-1"/> -{discountRate}%</div>}
                  {product.stock === 0 && <div className="absolute top-0 right-0 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-bl-lg z-10">품절</div>}
                  
                  {product.image ? (
                    <img src={product.image} alt={product.name} className={`aspect-[3/4] w-full object-cover rounded-lg mb-3 ${product.stock === 0 ? 'grayscale' : ''}`} />
                  ) : (
                    <div className="aspect-[3/4] w-full bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-gray-400 transition"><Package size={32} /></div>
                  )}
                  
                  <h3 className="font-bold text-gray-800 text-sm truncate mt-2">{product.name}</h3>
                  <p className="text-xs text-gray-500 mb-2">{product.color} / {product.size}</p>
                  <div className="flex justify-between items-end">
                    {tierForCustomer ? (
                      <div className="flex flex-col">
                        <span className="text-[11px] text-gray-400 line-through leading-none mb-0.5">₩ {product.price.toLocaleString()}</span>
                        <span className="font-bold text-indigo-600 leading-none">₩ {displayUnit.toLocaleString()}</span>
                      </div>
                    ) : hasSale ? (
                      <div className="flex flex-col">
                        <span className="text-[11px] text-gray-400 line-through leading-none mb-0.5">₩ {product.price.toLocaleString()}</span>
                        <span className="font-bold text-red-600 leading-none">₩ {product.salePrice.toLocaleString()}</span>
                      </div>
                    ) : (
                      <span className="font-bold text-blue-600">₩ {product.price.toLocaleString()}</span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded font-medium ${product.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>재고: {product.stock}</span>
                  </div>
                </div>
              );
            })}
            {filteredProductsForSales.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500">
                <Search size={48} className="mx-auto text-gray-300 mb-4" />
                <p>검색 결과가 없습니다.</p>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInventoryView = () => {
    const inventoryRegex = makeChosungRegex(inventorySearchQuery);
    const isEndedTab = inventoryTab === 'ended';
    const filteredInventory = products.filter(p => {
      if (isEndedTab ? !p.isEnded : !!p.isEnded) return false;
      return (
        inventoryRegex.test(p.name) ||
        (p.adminName && inventoryRegex.test(p.adminName)) ||
        (p.color && inventoryRegex.test(p.color)) ||
        p.id.toLowerCase().includes(inventorySearchQuery.toLowerCase())
      );
    });

    const groupMinIdByGroupId = {};
    products.forEach((p) => {
      if (!p.groupId) return;
      const n = Number(p.id);
      if (Number.isNaN(n)) return;
      if (groupMinIdByGroupId[p.groupId] === undefined || n < groupMinIdByGroupId[p.groupId]) {
        groupMinIdByGroupId[p.groupId] = n;
      }
    });

    const sortedInventory = [...filteredInventory].sort((a, b) => {
      const aIdNum = Number(a.id);
      const bIdNum = Number(b.id);
      const aKey = a.groupId && groupMinIdByGroupId[a.groupId] !== undefined ? groupMinIdByGroupId[a.groupId] : aIdNum;
      const bKey = b.groupId && groupMinIdByGroupId[b.groupId] !== undefined ? groupMinIdByGroupId[b.groupId] : bIdNum;

      if (!Number.isNaN(aKey) && !Number.isNaN(bKey) && aKey !== bKey) return aKey - bKey;

      // 같은 그룹은 코드 순으로
      if (a.groupId && b.groupId && a.groupId === b.groupId) {
        if (!Number.isNaN(aIdNum) && !Number.isNaN(bIdNum) && aIdNum !== bIdNum) return aIdNum - bIdNum;
      }

      // 기본은 코드 순
      if (!Number.isNaN(aIdNum) && !Number.isNaN(bIdNum) && aIdNum !== bIdNum) return aIdNum - bIdNum;
      return String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' });
    });

    const filteredIds = sortedInventory.map((p) => p.id);
    const selectedCount = inventorySelectedIds.size;
    const canGroup = selectedCount >= 2;
    const canUngroup = selectedCount >= 1;

    const toggleInventorySelect = (id, nextChecked) => {
      setInventorySelectedIds((prev) => {
        const next = new Set(prev);
        if (nextChecked) next.add(id);
        else next.delete(id);
        return next;
      });
    };

    const toggleInventorySelectAll = (nextChecked) => {
      setInventorySelectedIds((prev) => {
        const next = new Set(prev);
        if (nextChecked) filteredIds.forEach((id) => next.add(id));
        else filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    };

    const handleGroupSelectedProducts = () => {
      const ids = Array.from(inventorySelectedIds);
      if (ids.length < 2) return;
      const groupId = getNewProductGroupId();
      showConfirm(
        `선택한 ${ids.length}개 상품을 그룹으로 묶을까요?\n(그룹 내에서는 상품명/사이즈/가격 정보가 함께 변경됩니다.)`,
        () => {
          const nextProducts = products.map((p) => (ids.includes(p.id) ? { ...p, groupId } : p));
          setProducts(nextProducts);
          ids.forEach((id) => {
            const updated = nextProducts.find((p) => p.id === id);
            if (updated) saveItem('products', updated);
          });
          setInventorySelectedIds(new Set());
          showAlert(`그룹 설정 완료 (${ids.length}개)`);
        }
      );
    };

    const handleUngroupSelectedProducts = () => {
      const ids = Array.from(inventorySelectedIds);
      if (ids.length < 1) return;
      showConfirm(`선택한 ${ids.length}개 상품의 그룹을 해제할까요?`, () => {
        const nextProducts = products.map((p) => (ids.includes(p.id) ? { ...p, groupId: null } : p));
        setProducts(nextProducts);
        ids.forEach((id) => {
          const updated = nextProducts.find((p) => p.id === id);
          if (updated) saveItem('products', updated);
        });
        showAlert(`그룹 해제 완료 (${ids.length}개)`);
      });
    };

    const getGroupOuterCellClass = (idx, edge) => {
      const p = sortedInventory[idx];
      if (!p?.groupId) return '';
      const prev = sortedInventory[idx - 1];
      const next = sortedInventory[idx + 1];
      const isFirst = !prev || prev.groupId !== p.groupId;
      const isLast = !next || next.groupId !== p.groupId;

      // 테두리는 "그룹 외곽"만: 왼쪽 끝 셀/오른쪽 끝 셀에만 좌우 테두리 적용
      const borderSide =
        edge === 'left' ? 'border-l-2' : edge === 'right' ? 'border-r-2' : '';

      const roundTL = edge === 'left' && isFirst ? 'rounded-tl-lg' : '';
      const roundBL = edge === 'left' && isLast ? 'rounded-bl-lg' : '';
      const roundTR = edge === 'right' && isFirst ? 'rounded-tr-lg' : '';
      const roundBR = edge === 'right' && isLast ? 'rounded-br-lg' : '';

      return [
        'border-indigo-300',
        borderSide,
        isFirst ? 'border-t-2' : '',
        isLast ? 'border-b-2' : '',
        roundTL,
        roundBL,
        roundTR,
        roundBR,
      ]
        .filter(Boolean)
        .join(' ');
    };

    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800">상품 관리</h2>
            <div className="flex bg-gray-200 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setInventoryTab('active')}
                className={`px-4 py-1.5 font-bold rounded-md transition-colors ${inventoryTab === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                판매 상품
              </button>
              <button
                type="button"
                onClick={() => setInventoryTab('ended')}
                className={`px-4 py-1.5 font-bold rounded-md transition-colors ${inventoryTab === 'ended' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                종료 상품
              </button>
            </div>
          </div>
          <div className="flex space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input 
                type="text" 
                lang="ko"
                style={{ imeMode: 'active' }}
                placeholder="상품명, 관리명, 색상 검색..." 
                value={inventorySearchQuery}
                onChange={(e) => setInventorySearchQuery(normalizeChosungSearchInput(e.target.value))}
                className="pl-10 pr-10 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-64 transition-shadow shadow-sm" 
              />
              {inventorySearchQuery && (
                <button type="button" onClick={() => setInventorySearchQuery('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              )}
            </div>
            {inventoryTab === 'active' && (
              <button 
                onClick={openAddProductModal}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center hover:bg-blue-700 shadow-sm"
              >
                <Plus size={18} className="mr-2"/> 신규 상품 등록
              </button>
            )}
          </div>
        </div>
        <div className="mb-3 shrink-0 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            선택: <span className="font-black text-gray-900 tabular-nums">{selectedCount}</span>개
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGroupSelectedProducts}
              disabled={!canGroup}
              className={`px-3 py-2 rounded-md font-bold text-sm border shadow-sm transition ${
                canGroup
                  ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-500'
                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              }`}
            >
              그룹설정
            </button>
            <button
              type="button"
              onClick={handleUngroupSelectedProducts}
              disabled={!canUngroup}
              className={`px-3 py-2 rounded-md font-bold text-sm border shadow-sm transition ${
                canUngroup
                  ? 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              }`}
            >
              그룹해제
            </button>
            <button
              type="button"
              onClick={() => setInventorySelectedIds(new Set())}
              disabled={selectedCount === 0}
              className={`px-3 py-2 rounded-md font-bold text-sm border transition ${
                selectedCount > 0
                  ? 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  : 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'
              }`}
            >
              선택해제
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto pb-28" onScroll={handleContainerScroll} ref={mainScrollRef}>
            <table className="w-full text-left relative">
              <thead className="bg-gray-50 border-b sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-4 text-sm font-bold text-gray-600 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredIds.length > 0 && filteredIds.every((id) => inventorySelectedIds.has(id))}
                      onChange={(e) => toggleInventorySelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="p-4 text-sm font-bold text-gray-600">상품코드</th>
                  <th className="p-4 text-sm font-bold text-gray-600">상품명 (노출용 / 관리용)</th>
                  <th className="p-4 text-sm font-bold text-gray-600">색상</th>
                  <th className="p-4 text-sm font-bold text-gray-600">사이즈</th>
                  <th className="p-4 text-sm font-bold text-gray-600">도매단가</th>
                  <th className="p-4 text-sm font-bold text-gray-600">현재재고</th>
                  <th className="p-4 text-sm font-bold text-gray-600 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedInventory.map((p, idx) => {
                  const next = sortedInventory[idx + 1];
                  const prevRow = sortedInventory[idx - 1];
                  const inGroup = !!p.groupId;
                  const isFirstRowOfGroup = inGroup && (!prevRow || prevRow.groupId !== p.groupId);
                  const isLastRowOfGroup = inGroup && (!next || next.groupId !== p.groupId);

                  const groupEdgeCommonClass = inGroup
                    ? [
                        'border-indigo-300',
                        isFirstRowOfGroup ? 'border-t-2' : '',
                        isLastRowOfGroup ? 'border-b-2' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    : '';

                  const leftOuter = inGroup
                    ? [
                        groupEdgeCommonClass,
                        'border-l-2',
                        isFirstRowOfGroup ? 'rounded-tl-lg' : '',
                        isLastRowOfGroup ? 'rounded-bl-lg' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    : '';

                  const rightOuter = inGroup
                    ? [
                        groupEdgeCommonClass,
                        'border-r-2',
                        isFirstRowOfGroup ? 'rounded-tr-lg' : '',
                        isLastRowOfGroup ? 'rounded-br-lg' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    : '';

                  const middleOuter = inGroup ? groupEdgeCommonClass : '';
                  const rowBaseClass = `transition-colors ${
                    p.isEnded
                      ? 'bg-amber-50 opacity-90'
                      : p.stock === 0
                        ? 'bg-red-50 opacity-90'
                        : 'hover:bg-blue-50/50'
                  }`;
                  const rowGroupBg = p.groupId ? 'bg-indigo-50/30' : '';

                  const prev = prevRow;
                  const needsGapRow =
                    !!prev?.groupId && !!p.groupId && prev.groupId !== p.groupId;

                  return (
                    <Fragment key={p.id}>
                      {needsGapRow && (
                        <tr aria-hidden>
                          <td colSpan="8" className="h-2 bg-transparent"></td>
                        </tr>
                      )}
                      <tr
                        className={`${rowBaseClass} ${rowGroupBg} cursor-pointer`}
                        onClick={(e) => {
                          const interactive = e.target.closest('button, a, input, select, textarea');
                          if (interactive) return;
                          toggleInventorySelect(p.id, !inventorySelectedIds.has(p.id));
                        }}
                      >
                        <td
                          className={`p-4 text-center align-top ${leftOuter}`}
                          onClick={() => toggleInventorySelect(p.id, !inventorySelectedIds.has(p.id))}
                        >
                          <input
                            type="checkbox"
                            checked={inventorySelectedIds.has(p.id)}
                            onChange={(e) => toggleInventorySelect(p.id, e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className={`p-4 text-sm font-medium text-gray-900 ${middleOuter}`} onClick={(e) => e.stopPropagation()}>
                          {p.id}
                          {p.isEnded && <span className="block mt-1 bg-amber-200 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold w-max">종료상품</span>}
                          {p.groupId && <span className="block mt-1 bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded font-bold w-max">그룹</span>}
                        </td>
                        <td className={`p-4 ${middleOuter}`}>
                      <div className="flex items-center space-x-3">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className={`w-10 h-14 object-cover rounded shadow-sm flex-shrink-0 ${(p.stock === 0 || p.isEnded) ? 'grayscale' : ''}`} />
                        ) : (
                          <div className="w-10 h-14 bg-gray-100 flex items-center justify-center rounded shadow-sm text-gray-400 flex-shrink-0">
                            <Package size={16} />
                          </div>
                        )}
                        <div 
                          className="cursor-pointer group"
                          onClick={(e) => { e.stopPropagation(); handleGoToProductDetail(p); }}
                        >
                          <span className={`text-sm font-bold group-hover:underline flex items-center ${p.isEnded ? 'text-amber-800' : 'text-blue-600'}`}>
                            {p.name}
                            {p.salePrice && p.salePrice < p.price && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded">세일</span>}
                          </span>
                          {p.adminName && <p className="text-xs text-gray-400 mt-0.5">{p.adminName}</p>}
                        </div>
                      </div>
                        </td>
                        <td className={`p-4 text-sm text-gray-600 ${middleOuter}`} onClick={(e) => e.stopPropagation()}>{p.color}</td>
                        <td className={`p-4 text-sm text-gray-600 ${middleOuter}`} onClick={(e) => e.stopPropagation()}>{p.size}</td>
                    
                        <td className={`p-4 text-sm font-medium ${middleOuter}`} onClick={(e) => e.stopPropagation()}>
                      {p.salePrice && p.salePrice < p.price ? (
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-400 line-through">₩ {p.price.toLocaleString()}</span>
                          <span className="text-red-600 font-bold">₩ {p.salePrice.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span>₩ {p.price.toLocaleString()}</span>
                      )}
                        </td>

                        <td className={`p-4 ${middleOuter}`} onClick={(e) => e.stopPropagation()}>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.isEnded ? 'bg-amber-200 text-amber-800 border border-amber-300' : (p.stock === 0 ? 'bg-red-100 text-red-700 border border-red-200' : p.stock < 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')}`}>
                        {p.stock === 0 ? '품절' : `${p.stock} 장`}
                      </span>
                        </td>
                        <td className={`p-4 text-sm text-center whitespace-nowrap ${rightOuter}`} onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); handleToggleEndProduct(p); }} className={`font-medium px-3 py-1.5 rounded mr-2 border shadow-sm ${p.isEnded ? 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100' : 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'}`}>
                        {p.isEnded ? '판매재개' : '종료처리'}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleGoToProductDetail(p, true); }} className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1.5 rounded mr-2 border border-blue-100">수정</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(p.id); }} className="text-red-500 hover:text-red-700 font-medium bg-red-50 px-3 py-1.5 rounded border border-red-100">삭제</button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
                {filteredInventory.length === 0 && (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-gray-500">
                      {inventorySearchQuery
                        ? '검색 결과가 없습니다.'
                        : isEndedTab
                          ? '종료된 상품이 없습니다.'
                          : '등록된 판매 상품이 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAddProductView = ({ inModal = false } = {}) => {
    const handleAddProductChange = (e) => setAddProductForm({ ...addProductForm, [e.target.name]: e.target.value });
    const suppliers = customers.filter(c => c.type === '매입처');

    const handleImageUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 600;

            if (width > height && width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            setAddProductForm({ ...addProductForm, image: compressedBase64 });
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file); 
      }
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!addProductForm.name || !addProductForm.price) {
        showAlert("상품명과 단가는 필수 입력 항목입니다.");
        return;
      }
      
      let maxIdNum = 0;
      products.forEach(p => {
        const match = p.id.match(/^P0*(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxIdNum) maxIdNum = num;
        }
      });
      const nextNum = maxIdNum > 0 ? maxIdNum + 1 : products.length + 1;
      const newId = `P${String(nextNum).padStart(4, '0')}`;
      
      const initialStockNum = Number(addProductForm.stock) || 0;
      const newProduct = {
        id: newId,
        name: addProductForm.name,
        adminName: addProductForm.adminName, 
        category: addProductForm.category,
        color: addProductForm.color || 'Free',
        size: addProductForm.size || 'Free',
        price: Number(addProductForm.price),
        salePrice: null,
        stock: initialStockNum,
        initialStock: initialStockNum,
        restockedQty: 0,
        material: addProductForm.material,
        origin: addProductForm.origin,
        image: addProductForm.image,
        supplierId: addProductForm.supplierId,
        isEnded: false,
        customerPrices: {}
      };
      
      setProducts([...products, newProduct]);
      saveItem('products', newProduct); 

      if (initialStockNum > 0) {
        const now = new Date();
        const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        const supplierName = addProductForm.supplierId ? customers.find(c => c.id === addProductForm.supplierId)?.name : '자체제작/기타';
        
        const historyItem = {
          id: `RS_${Date.now()}`,
          date: addProductForm.date || getTodayStr(), 
          time: timeStr,
          productId: newId,
          productName: addProductForm.name,
          color: addProductForm.color || 'Free',
          size: addProductForm.size || 'Free',
          supplier: supplierName,
          qty: initialStockNum,
          type: '초기입고'
        };
        saveItem('restockHistory', historyItem);
      }

      showAlert(`[${addProductForm.name}] 상품이 등록되었습니다.\n(상품코드: ${newId})`, () => {
        setAddProductForm({ name: '', adminName: '', category: '상의', color: '', size: 'Free', price: '', stock: '', material: '', origin: '', image: '', supplierId: '', date: getTodayStr() });
        if (inModal) closeAddProductModal();
        else goBack();
      });
    };

    const handleProductFormKeyDown = (e) => {
      if (e.key === 'Enter' && !modalConfig.isOpen) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return;
        
        e.preventDefault();
        const form = e.currentTarget;
        const inputs = Array.from(form.querySelectorAll('input:not([type="file"]), select, textarea, button[type="submit"]'));
        const index = inputs.indexOf(e.target);
        
        if (index > -1 && index < inputs.length - 1) {
             const nextEl = inputs[index + 1];
             nextEl.focus();
             if (nextEl.tagName === 'INPUT') setTimeout(() => nextEl.select(), 10);
        }
      }
    };

    const cancelAddProduct = inModal ? closeAddProductModal : goBack;

    return (
      <div className={inModal ? '' : 'px-6 pb-6 pt-2 overflow-y-auto'} onScroll={!inModal ? handleContainerScroll : undefined} ref={!inModal ? mainScrollRef : undefined}>
        {!inModal && (
          <div className="flex items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">신규 상품 등록</h2>
          </div>
        )}
        
        <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${inModal ? 'border-0 shadow-none p-0' : 'p-8 max-w-4xl'}`}>
          <form onSubmit={handleSubmit} onKeyDown={handleProductFormKeyDown} className="flex flex-col md:flex-row gap-6 md:gap-8">
            <div className="w-full md:w-1/3 max-w-[280px] aspect-[3/4] bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 overflow-hidden relative group shrink-0 self-start mx-auto md:mx-0">
              {addProductForm.image ? (
                <>
                  <img src={addProductForm.image} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200">
                    <span className="text-white font-bold bg-black/60 px-4 py-2 rounded-lg flex items-center text-sm">
                      <Upload size={18} className="mr-2" /> 이미지 변경
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAddProductForm({ ...addProductForm, image: '' }); }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md hover:bg-red-600 z-10"
                    title="이미지 삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              ) : (
                <>
                  <Upload size={48} className="mb-3 text-gray-400" />
                  <span className="text-sm font-bold text-gray-500 text-center px-4">클릭하여 이미지 등록</span>
                  <span className="text-xs text-gray-400 mt-1">JPG, PNG</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" tabIndex="-1" />
            </div>

            <div className="flex-1 min-w-0 flex flex-col">
              <div className="space-y-4 flex-1">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">노출용 상품명 (고객용) *</label>
                  <input type="text" name="name" lang="ko" style={{ imeMode: 'active' }} value={addProductForm.name} onChange={handleAddProductChange} placeholder="예) 오버핏 카라 니트" className="w-full text-xl font-bold border-b border-gray-300 pb-1 focus:border-blue-500 outline-none bg-transparent" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">관리용 상품명 (도매용)</label>
                  <input type="text" name="adminName" lang="ko" style={{ imeMode: 'active' }} value={addProductForm.adminName} onChange={handleAddProductChange} placeholder="예) A-01 카라니트" className="w-full text-md border-b border-gray-300 pb-1 focus:border-blue-500 outline-none bg-transparent" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <label className="block text-xs text-gray-500 mb-1">도매단가 (원) *</label>
                    <input type="number" name="price" value={addProductForm.price} onChange={handleAddProductChange} onWheel={preventMoneyInputWheel} placeholder="18000" className="input-money-no-spin w-full font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none tabular-nums" />
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <label className="block text-xs text-blue-700 mb-1 font-bold">초기 재고수량 (장)</label>
                    <input type="number" name="stock" value={addProductForm.stock} onChange={handleAddProductChange} placeholder="50" className="w-full font-bold text-blue-800 bg-transparent border-b border-blue-300 focus:border-blue-500 outline-none tabular-nums" />
                  </div>
                  <div className="col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <label className="block text-xs text-slate-600 mb-1 font-medium">매입처</label>
                    <select name="supplierId" value={addProductForm.supplierId} onChange={handleAddProductChange} className="w-full border border-slate-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm">
                      <option value="">— 매입처 선택 (선택) —</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">입고 일자</label>
                    <input type="date" name="date" value={addProductForm.date || getTodayStr()} onChange={handleAddProductChange} className="w-full border border-gray-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">분류</label>
                    <select name="category" value={addProductForm.category} onChange={handleAddProductChange} className="w-full border border-gray-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm">
                      <option value="상의">상의</option>
                      <option value="하의">하의</option>
                      <option value="세트">세트</option>
                      <option value="아우터">아우터</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">색상</label>
                    <input type="text" name="color" lang="ko" style={{ imeMode: 'active' }} value={addProductForm.color} onChange={handleAddProductChange} placeholder="베이지" className="w-full border border-gray-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">사이즈</label>
                    <select name="size" value={addProductForm.size} onChange={handleAddProductChange} className="w-full border border-gray-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm">
                      <option value="Free">Free</option>
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                      <option value="XL">XL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">제조국</label>
                    <input type="text" name="origin" lang="ko" style={{ imeMode: 'active' }} value={addProductForm.origin} onChange={handleAddProductChange} placeholder="대한민국" className="w-full border border-gray-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">혼용률</label>
                    <input type="text" name="material" lang="ko" style={{ imeMode: 'active' }} value={addProductForm.material} onChange={handleAddProductChange} placeholder="면 80%, 폴리 20%" className="w-full border border-gray-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-gray-100 shrink-0">
                <button type="button" onClick={cancelAddProduct} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm" tabIndex="-1">취소</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm text-sm">상품 등록</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderProductDetailView = ({ inModal = false } = {}) => {
    if (!selectedProduct) return null;

    const suppliers = customers.filter(c => c.type === '매입처');

    const tierCustomerRegex = makeChosungRegex(productCustomerPriceSearch);
    const tierSalesCustomers = customers.filter(c =>
      (!c.type || c.type === '판매처' || c.type === '매출처') &&
      (tierCustomerRegex.test(c.name) || c.id.toLowerCase().includes(productCustomerPriceSearch.toLowerCase()))
    );

    const addTierPriceRow = () => {
      if (!customerTierPricePickId) {
        showAlert('목록에서 업체를 선택하세요.');
        return;
      }
      const amt = Number(customerTierPriceInput);
      if (customerTierPriceInput === '' || Number.isNaN(amt) || amt < 0) {
        showAlert('차등 금액(원)을 입력하세요.');
        return;
      }
      setProductEditForm({
        ...productEditForm,
        customerPrices: { ...(productEditForm.customerPrices || {}), [customerTierPricePickId]: amt },
      });
      setCustomerTierPriceInput('');
    };

    const removeTierPriceRow = (customerId) => {
      const next = { ...(productEditForm.customerPrices || {}) };
      delete next[customerId];
      setProductEditForm({ ...productEditForm, customerPrices: next });
      if (customerTierPricePickId === customerId) setCustomerTierPricePickId('');
    };

    const handleRestock = (isReturn = false) => {
      if (!productRestockSupplierId) {
        showAlert('매입처를 선택하세요.');
        return;
      }

      const qty = Number(productRestockQty);
      if (qty > 0) {
        let stockDelta = isReturn ? -qty : qty;
        let newStock = selectedProduct.stock + stockDelta;

        if (newStock < 0) {
          showAlert('현재 재고보다 반품하려는 수량이 더 많습니다.');
          return;
        }

        const newRestockedQty = isReturn ? (selectedProduct.restockedQty || 0) : (selectedProduct.restockedQty || 0) + qty;
        const updatedProduct = { ...selectedProduct, stock: newStock, restockedQty: newRestockedQty };
        
        if (!isReturn && qty > 0 && updatedProduct.isEnded) {
            updatedProduct.isEnded = false; 
        }

        setProducts(products.map(p => p.id === selectedProduct.id ? updatedProduct : p));
        setSelectedProduct(updatedProduct);
        saveItem('products', updatedProduct); 

        const now = new Date();
        const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        const supplierName = customers.find(c => c.id === productRestockSupplierId)?.name;

        const historyItem = {
          id: `RS_${Date.now()}`,
          date: productRestockDate, 
          time: timeStr,
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          color: selectedProduct.color,
          size: selectedProduct.size,
          supplier: supplierName,
          qty: isReturn ? -qty : qty,
          type: isReturn ? '매입처반품' : '재입고'
        };
        saveItem('restockHistory', historyItem);

        setProductRestockQty('');
        setProductRestockSupplierId('');
        showAlert(`[${productRestockDate}] 날짜로 ${qty}장 ${isReturn ? '불량 반품' : '추가 입고'} 처리되었습니다.\n(입고 내역에 저장됨)`);
      } else {
        showAlert('올바른 수량을 입력하세요.');
      }
    };

    const handleEditImageUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 600;

            if (width > height && width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            setProductEditForm({ ...productEditForm, image: compressedBase64 });
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    };

    const handleSaveEdit = () => {
      const salePriceNum = productEditForm.salePrice ? Number(productEditForm.salePrice) : null;
      const initialStockNum = productEditForm.initialStock !== undefined ? Number(productEditForm.initialStock) : productEditForm.stock;
      const restockedQtyNum = productEditForm.restockedQty !== undefined ? Number(productEditForm.restockedQty) : 0;
      
      const oldInitialStock = selectedProduct.initialStock ?? selectedProduct.stock;
      const oldRestockedQty = selectedProduct.restockedQty || 0;
      const stockDiff = (initialStockNum - oldInitialStock) + (restockedQtyNum - oldRestockedQty);
      const newStock = Math.max(0, productEditForm.stock + stockDiff);

      const updated = {
        ...productEditForm,
        price: Number(productEditForm.price),
        salePrice: salePriceNum,
        initialStock: initialStockNum,
        restockedQty: restockedQtyNum,
        stock: newStock,
        customerPrices: productEditForm.customerPrices && typeof productEditForm.customerPrices === 'object'
          ? { ...productEditForm.customerPrices }
          : {}
      };

      if (stockDiff > 0 && updated.isEnded) {
          updated.isEnded = false; 
      }

      const labelFieldsChanged =
        selectedProduct.name !== updated.name ||
        selectedProduct.color !== updated.color ||
        selectedProduct.size !== updated.size;

      setProducts(products.map(p => p.id === updated.id ? updated : p));
      saveItem('products', updated);
      setSelectedProduct(updated);
      setProductDetailEditMode(false);

      if (labelFieldsChanged) {
        syncProductLabelsAcrossRecords(updated.id, updated);
      }

      if (updated.groupId) {
        const sharedPatch = {
          name: updated.name,
          adminName: updated.adminName,
          size: updated.size,
          price: updated.price,
          salePrice: updated.salePrice,
          customerPrices: { ...(updated.customerPrices || {}) },
        };
        const nextProducts = products.map((p) => {
          if (p.id === updated.id) return p;
          if (!p.groupId || p.groupId !== updated.groupId) return p;
          return { ...p, ...sharedPatch };
        });
        setProducts(nextProducts);
        nextProducts.forEach((p) => {
          if (p.id !== updated.id && p.groupId === updated.groupId) saveItem('products', p);
        });
      }

      showAlert('상품 정보가 성공적으로 수정되었습니다.');
    };

    const hasSale = selectedProduct.salePrice && selectedProduct.salePrice < selectedProduct.price;
    const discountRate = hasSale ? Math.round((1 - selectedProduct.salePrice / selectedProduct.price) * 100) : 0;

    return (
      <div className={inModal ? 'p-5 flex min-h-0 flex-col w-full max-w-4xl' : 'px-6 pb-6 pt-2 flex min-h-0 flex-1 flex-col'}>
        <div className="flex items-center justify-between mb-6 shrink-0 gap-3">
          <div className="flex items-center min-w-0">
            <h2 className="text-2xl font-bold text-gray-800">상품 상세 정보</h2>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {productDetailEditMode ? (
              <>
                <button onClick={() => setProductDetailEditMode(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">취소</button>
                <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">수정사항 저장</button>
              </>
            ) : (
              <>
                <button onClick={() => {
                  setProductEditForm({
                    ...selectedProduct,
                    customerPrices: selectedProduct.customerPrices ? { ...selectedProduct.customerPrices } : {}
                  });
                  setProductDetailEditMode(true);
                  setProductCustomerPriceSearch('');
                  setCustomerTierPricePickId('');
                  setCustomerTierPriceInput('');
                  setProductTierCustomerDropdownOpen(false);
                }} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium shadow-sm">수정</button>
                <button onClick={() => handleDeleteProduct(selectedProduct.id)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium shadow-sm">삭제</button>
              </>
            )}
            {inModal && (
              <button type="button" onClick={closeProductDetailModal} className="px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 font-medium shadow-sm">
                닫기
              </button>
            )}
          </div>
        </div>

        <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-8 pb-16 w-full flex flex-1 min-h-0 flex-col md:flex-row gap-8 ${inModal ? '' : 'max-w-4xl overflow-y-auto overscroll-contain'}`} onScroll={inModal ? undefined : handleContainerScroll} ref={inModal ? undefined : mainScrollRef}>
          
          <div className="w-full md:w-1/3 max-w-[320px] aspect-[3/4] bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 overflow-hidden relative group shrink-0 self-start">
            {productDetailEditMode ? (
              <>
                {productEditForm.image ? (
                  <img src={productEditForm.image} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <><Upload size={48} className="mb-3 text-gray-400"/><span className="text-sm font-bold text-gray-500">클릭하여 이미지 등록</span></>
                )}
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200">
                  <span className="text-white font-bold bg-black bg-opacity-60 px-4 py-2 rounded-lg flex items-center">
                    <Upload size={18} className="mr-2" /> 이미지 변경
                  </span>
                </div>
                <input type="file" accept="image/*" onChange={handleEditImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </>
            ) : (
              selectedProduct.image ? (
                <img src={selectedProduct.image} alt={selectedProduct.name} className={`w-full h-full object-cover ${(selectedProduct.stock === 0 || selectedProduct.isEnded) ? 'grayscale' : ''}`} />
              ) : (
                <><Package size={64} className="mb-4 text-gray-300"/><span className="text-sm">이미지 없음</span></>
              )
            )}
          </div>

          <div className="w-full md:w-2/3">
            {productDetailEditMode ? (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">노출용 상품명 (고객용)</label>
                  <input type="text" lang="ko" style={{ imeMode: 'active' }} value={productEditForm.name} onChange={e => setProductEditForm({...productEditForm, name: e.target.value})} className="w-full text-xl font-bold border-b border-gray-300 pb-1 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">관리용 상품명 (도매용)</label>
                  <input type="text" lang="ko" style={{ imeMode: 'active' }} value={productEditForm.adminName || ''} onChange={e => setProductEditForm({...productEditForm, adminName: e.target.value})} className="w-full text-md border-b border-gray-300 pb-1 focus:border-blue-500 outline-none" placeholder="비워두면 노출되지 않습니다" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-gray-50 p-3 rounded-lg border">
                    <label className="block text-xs text-gray-500 mb-1">정상가 (원)</label>
                    <input type="number" value={productEditForm.price} onChange={e => setProductEditForm({...productEditForm, price: e.target.value})} onWheel={preventMoneyInputWheel} className="input-money-no-spin w-full font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none" />
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                    <label className="block text-xs text-red-500 mb-1 font-bold">세일 할인가 (원)</label>
                    <input type="number" value={productEditForm.salePrice || ''} placeholder="할인 없을시 비워둠" onChange={e => setProductEditForm({...productEditForm, salePrice: e.target.value})} onWheel={preventMoneyInputWheel} className="input-money-no-spin w-full font-bold text-red-600 bg-transparent border-b border-red-300 focus:border-red-500 outline-none placeholder-red-300" />
                  </div>
                  
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 col-span-2">
                    <label className="block text-xs text-blue-700 mb-1 font-bold">초기 재고수량 (장)</label>
                    <input type="number" value={productEditForm.initialStock ?? productEditForm.stock} onChange={e => setProductEditForm({...productEditForm, initialStock: e.target.value})} className="w-full font-bold text-blue-800 bg-transparent border-b border-blue-300 focus:border-blue-500 outline-none" />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">분류</label>
                    <select value={productEditForm.category || '상의'} onChange={e => setProductEditForm({...productEditForm, category: e.target.value})} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="상의">상의</option>
                      <option value="하의">하의</option>
                      <option value="세트">세트</option>
                      <option value="아우터">아우터</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">색상</label>
                    <input type="text" lang="ko" style={{ imeMode: 'active' }} value={productEditForm.color} onChange={e => setProductEditForm({...productEditForm, color: e.target.value})} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">사이즈</label>
                    <select value={productEditForm.size || 'Free'} onChange={e => setProductEditForm({...productEditForm, size: e.target.value})} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="Free">Free</option>
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                      <option value="XL">XL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">혼용률</label>
                    <input type="text" lang="ko" style={{ imeMode: 'active' }} value={productEditForm.material || ''} onChange={e => setProductEditForm({...productEditForm, material: e.target.value})} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">제조국</label>
                    <input type="text" lang="ko" style={{ imeMode: 'active' }} value={productEditForm.origin || ''} onChange={e => setProductEditForm({...productEditForm, origin: e.target.value})} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3 relative z-30">
                  <div>
                    <h3 className="text-sm font-bold text-indigo-900">업체별 차등 금액 적용</h3>
                    <p className="text-xs text-indigo-900/70 mt-0.5">판매처를 검색한 뒤 목록에서 업체를 선택하고, 차등 단가를 입력해 추가하세요.</p>
                  </div>
                  <div className="relative z-40">
                    <Search className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
                    <input
                      type="text"
                      lang="ko"
                      style={{ imeMode: 'active' }}
                      placeholder="업체명 검색 (초성 가능)"
                      value={productCustomerPriceSearch}
                      onChange={(e) => {
                        setProductCustomerPriceSearch(normalizeChosungSearchInput(e.target.value));
                        setProductTierCustomerDropdownOpen(true);
                      }}
                      onFocus={() => {
                        if (productCustomerPriceSearch.trim()) setProductTierCustomerDropdownOpen(true);
                      }}
                      onBlur={() => {
                        window.setTimeout(() => setProductTierCustomerDropdownOpen(false), 200);
                      }}
                      className="w-full pl-9 pr-3 py-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                    {productTierCustomerDropdownOpen && productCustomerPriceSearch.trim() !== '' && tierSalesCustomers.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl overscroll-contain">
                        {tierSalesCustomers.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            className={`w-full touch-manipulation text-left px-3 py-2.5 text-sm flex justify-between items-center border-b border-gray-100 last:border-0 transition ${customerTierPricePickId === c.id ? 'bg-indigo-100 text-indigo-900 font-bold' : 'hover:bg-gray-50 active:bg-indigo-50'}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setCustomerTierPricePickId(c.id);
                              setProductCustomerPriceSearch(c.name);
                              setProductTierCustomerDropdownOpen(false);
                            }}
                          >
                            <span>{c.name}</span>
                            <span className="text-xs text-gray-500 shrink-0 ml-2">{c.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {productTierCustomerDropdownOpen && productCustomerPriceSearch.trim() !== '' && tierSalesCustomers.length === 0 && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-xl px-3 py-4 text-center text-gray-500 text-sm">
                        검색 결과가 없습니다.
                      </div>
                    )}
                  </div>
                  {customerTierPricePickId && (
                    <p className="text-xs text-indigo-800 font-medium">
                      선택됨: <span className="font-bold">{customers.find(x => x.id === customerTierPricePickId)?.name || customerTierPricePickId}</span>
                      <button
                        type="button"
                        className="ml-2 text-indigo-600 underline font-bold"
                        onClick={() => {
                          setCustomerTierPricePickId('');
                          setProductCustomerPriceSearch('');
                        }}
                      >
                        선택 해제
                      </button>
                    </p>
                  )}
                  <div className="flex flex-wrap items-end gap-2 pt-1">
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-xs font-medium text-gray-600 mb-1">차등 단가 (원)</label>
                      <input
                        type="number"
                        min={0}
                        value={customerTierPriceInput}
                        onChange={(e) => setCustomerTierPriceInput(e.target.value)}
                        onWheel={preventMoneyInputWheel}
                        placeholder="예: 15000"
                        className="input-money-no-spin w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addTierPriceRow}
                      className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm min-h-[42px] shrink-0 touch-manipulation"
                    >
                      추가
                    </button>
                  </div>
                  {productEditForm.customerPrices && Object.keys(productEditForm.customerPrices).length > 0 && (
                    <ul className="space-y-2 pt-2 border-t border-indigo-200">
                      {Object.entries(productEditForm.customerPrices).map(([cid, val]) => {
                        const cust = customers.find(x => x.id === cid);
                        return (
                          <li key={cid} className="flex items-center justify-between gap-2 text-sm bg-white/90 rounded-lg px-3 py-2 border border-indigo-100">
                            <span className="font-medium text-gray-800">{cust ? cust.name : cid}</span>
                            <span className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-indigo-700">₩ {Number(val).toLocaleString()}</span>
                              <button type="button" onClick={() => removeTierPriceRow(cid)} className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded border border-red-100 bg-red-50">삭제</button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md transition"
                  >
                    수정사항 저장
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6 border-b pb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{selectedProduct.id}</span>
                    <div className="flex space-x-2">
                      {selectedProduct.isEnded && <span className="px-3 py-1 rounded-full text-sm font-bold bg-amber-200 text-amber-800">종료상품</span>}
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">초기 재고: {selectedProduct.initialStock ?? selectedProduct.stock}장</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${selectedProduct.isEnded ? 'bg-amber-100 text-amber-700' : (selectedProduct.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')}`}>현재 재고: {selectedProduct.stock}장</span>
                    </div>
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-1">{selectedProduct.name}</h1>
                  {selectedProduct.adminName && <p className="text-sm text-gray-500 mb-3">관리명: {selectedProduct.adminName}</p>}
                  
                  {hasSale ? (
                    <div className="flex items-end space-x-3 mt-2">
                      <span className="text-xl text-gray-400 line-through leading-none pb-1">₩ {selectedProduct.price.toLocaleString()}</span>
                      <span className="text-3xl font-bold text-red-600 leading-none">₩ {selectedProduct.salePrice.toLocaleString()}</span>
                      <span className="bg-red-100 text-red-700 font-bold px-2 py-1 rounded text-sm mb-1">-{discountRate}% 세일</span>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-gray-800 mt-2">₩ {selectedProduct.price.toLocaleString()}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">분류</p>
                    <p className="font-medium text-gray-900">{selectedProduct.category || '상의'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">색상</p>
                    <p className="font-medium text-gray-900">{selectedProduct.color}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">사이즈</p>
                    <p className="font-medium text-gray-900">{selectedProduct.size}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">혼용률</p>
                    <p className="font-medium text-gray-900">{selectedProduct.material || '정보 없음'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500 mb-1">제조국</p>
                    <p className="font-medium text-gray-900">{selectedProduct.origin || '정보 없음'}</p>
                  </div>
                  {selectedProduct.customerPrices && Object.keys(selectedProduct.customerPrices).length > 0 && (
                    <div className="col-span-2 p-4 rounded-xl border border-indigo-100 bg-indigo-50/40">
                      <p className="text-sm font-bold text-indigo-900 mb-2">업체별 차등 단가</p>
                      <ul className="space-y-1.5">
                        {Object.entries(selectedProduct.customerPrices).map(([cid, val]) => {
                          const cust = customers.find(c => c.id === cid);
                          return (
                            <li key={cid} className="flex justify-between text-sm gap-2">
                              <span className="text-gray-700">{cust ? `${cust.name}` : cid}<span className="text-gray-400 ml-1 text-xs">({cid})</span></span>
                              <span className="font-bold text-indigo-700 shrink-0">₩ {Number(val).toLocaleString()}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col gap-4">
                  <div>
                    <p className="text-sm font-bold text-gray-800">재고 입출고 관리 (매입처)</p>
                    <p className="text-xs text-gray-500">매입처, 일자, 수량을 입력하여 입고(사입) 또는 불량 반품을 처리하세요.</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <input 
                      type="date" 
                      value={productRestockDate} 
                      onChange={(e) => setProductRestockDate(e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white font-medium flex-1 min-w-[130px]"
                      title="입고/반품 일자 선택"
                    />
                    <select
                      value={productRestockSupplierId} onChange={(e) => setProductRestockSupplierId(e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white flex-1 min-w-[140px]"
                    >
                      <option value="">-- 매입처 선택 --</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input
                      type="number" value={productRestockQty} onChange={(e) => setProductRestockQty(e.target.value)}
                      placeholder="수량" className="w-24 p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-right"
                    />
                    <div className="flex space-x-1">
                      <button onClick={() => handleRestock(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 whitespace-nowrap shadow-sm">입고 반영</button>
                      <button onClick={() => handleRestock(true)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 whitespace-nowrap shadow-sm">불량 반품</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRestockHistoryView = () => {
    const restockRegex = makeChosungRegex(restockSearchQuery);

    const handleDeleteRestock = (historyId) => {
      showConfirm('해당 입출고 내역을 삭제하시겠습니까?\n(삭제 시 해당 수량만큼 재고가 복구/차감됩니다)', () => {
        const log = restockHistory.find(r => r.id === historyId);
        if (!log) return;

        setRestockHistory(prev => prev.filter(r => r.id !== historyId));
        deleteItem('restockHistory', historyId);

        const pIdx = products.findIndex(p => p.id === log.productId);
        if (pIdx !== -1) {
          const updatedProduct = { ...products[pIdx] };
          updatedProduct.stock = Math.max(0, updatedProduct.stock - log.qty);
          if (log.type !== '매입처반품') {
             updatedProduct.restockedQty = Math.max(0, (updatedProduct.restockedQty || 0) - log.qty);
          }
          
          setProducts(prev => prev.map(p => p.id === log.productId ? updatedProduct : p));
          saveItem('products', updatedProduct);

          if (selectedProduct && selectedProduct.id === log.productId) {
            setSelectedProduct(updatedProduct);
          }
        }
        showAlert('내역이 삭제되었으며, 재고에 반영 복구되었습니다.');
      });
    };

    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h2 className="text-2xl font-bold text-gray-800">입고 내역</h2>
          <div className="flex space-x-3 items-center">
            {restockViewType === 'daily' && (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input 
                  type="text" 
                  lang="ko"
                  style={{ imeMode: 'active' }}
                  placeholder="상품명 또는 매입처 검색..." 
                  value={restockSearchQuery}
                  onChange={(e) => setRestockSearchQuery(normalizeChosungSearchInput(e.target.value))}
                  className="pl-10 pr-10 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-64 transition-shadow shadow-sm" 
                />
                {restockSearchQuery && (
                  <button onClick={() => setRestockSearchQuery('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    <X size={18} />
                  </button>
                )}
              </div>
            )}
            <div className="flex bg-gray-200 p-1 rounded-lg">
              <button onClick={() => setRestockViewType('daily')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center ${restockViewType === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><List size={16} className="mr-1"/>목록형</button>
              <button onClick={() => setRestockViewType('calendar')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center ${restockViewType === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><CalendarDays size={16} className="mr-1"/>달력형</button>
            </div>
          </div>
        </div>

        {restockViewType === 'daily' ? (() => {
          const filteredHistory = restockHistory.filter(h => 
            h.date === restockSearchDate &&
            (restockRegex.test(getRestockProductName(products, h)) || (h.supplier && restockRegex.test(h.supplier)))
          );
          const dailyTotalRestockQty = filteredHistory.reduce((sum, item) => sum + item.qty, 0);
          
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                <div className="flex items-center space-x-3">
                  <h3 className="font-bold text-gray-800">일자별 입/출고 현황</h3>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="date" 
                      value={restockSearchDate} 
                      onChange={(e) => setRestockSearchDate(e.target.value)}
                      className="p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
                    />
                    <button 
                      onClick={() => setRestockSearchDate(getTodayStr())}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md text-sm font-bold hover:bg-blue-100 transition"
                    >
                      오늘
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto" onScroll={handleContainerScroll} ref={mainScrollRef}>
                <table className="w-full text-left relative">
                  <thead className="bg-gray-50 border-b sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-4 text-sm font-bold text-gray-600">일자</th>
                      <th className="p-4 text-sm font-bold text-gray-600">시간</th>
                      <th className="p-4 text-sm font-bold text-gray-600">매입처</th>
                      <th className="p-4 text-sm font-bold text-gray-600">상품명</th>
                      <th className="p-4 text-sm font-bold text-gray-600">옵션 (색상/사이즈)</th>
                      <th className="p-4 text-sm font-bold text-gray-600 text-center">구분</th>
                      <th className="p-4 text-sm font-bold text-gray-600 text-right">수량</th>
                      <th className="p-4 text-sm font-bold text-gray-600 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredHistory.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="p-4 text-sm text-gray-600">{log.date}</td>
                        <td className="p-4 text-sm text-gray-600">{log.time}</td>
                        <td className="p-4 text-sm font-bold text-gray-800">{log.supplier}</td>
                        <td className="p-4 text-sm text-blue-600 font-bold cursor-pointer hover:underline" onClick={() => {
                          const prod = products.find(p => p.id === log.productId);
                          if (prod) { handleGoToProductDetail(prod); }
                        }}>
                          {getRestockProductName(products, log)}
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {(findProductById(products, log.productId)?.color ?? log.color)} / {(findProductById(products, log.productId)?.size ?? log.size)}
                        </td>
                        <td className="p-4 text-sm text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            log.type === '초기입고' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 
                            log.type === '매입처반품' ? 'bg-red-50 text-red-700 border border-red-200' :
                            'bg-green-50 text-green-700 border border-green-200'
                          }`}>
                            {log.type || '재입고'}
                          </span>
                        </td>
                        <td className={`p-4 text-sm font-bold text-right ${log.qty > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {log.qty > 0 ? '+' : ''}{log.qty}장
                        </td>
                        <td className="p-4 text-sm text-center space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openRestockEditModal(log)}
                            className="text-blue-600 border border-blue-200 bg-blue-50 px-2 py-1 rounded text-xs hover:bg-blue-100 font-bold transition"
                          >
                            수정
                          </button>
                          <button onClick={() => handleDeleteRestock(log.id)} className="text-red-500 border border-red-200 bg-red-50 px-2 py-1 rounded text-xs hover:bg-red-100 font-bold transition">
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredHistory.length === 0 && (
                      <tr><td colSpan="8" className="p-8 text-center text-gray-500">해당 날짜의 내역이 없습니다.</td></tr>
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200 sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                    <tr>
                      <td colSpan="6" className="p-4 text-sm font-bold text-center text-gray-800">총 입고 합계 (반품 반영)</td>
                      <td className={`p-4 text-sm font-bold text-right ${dailyTotalRestockQty >= 0 ? 'text-green-700' : 'text-red-600'}`}>{dailyTotalRestockQty}장</td>
                      <td className="p-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })() : (() => {
          const mapData = {};
          restockHistory.filter(h => h.date.startsWith(restockSearchMonth)).forEach(h => {
            if (!mapData[h.date]) mapData[h.date] = { qty: 0 };
            mapData[h.date].qty += h.qty;
          });
          
          Object.keys(mapData).forEach(date => {
            mapData[date].content = (
              <div className={`font-bold ${mapData[date].qty >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {mapData[date].qty >= 0 ? '입고: +' : '반품: '}{mapData[date].qty}장
              </div>
            );
          });

          return (
            <div className="flex flex-col h-full overflow-y-auto" onScroll={handleContainerScroll} ref={mainScrollRef}>
               <div className="flex items-center space-x-3 mb-4 bg-white p-3 rounded-lg shadow-sm border border-gray-100 w-max">
                  <h3 className="font-bold text-gray-800">월 선택</h3>
                  <input 
                    type="month" 
                    value={restockSearchMonth} 
                    onChange={(e) => setRestockSearchMonth(e.target.value)}
                    className="p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
                  />
                  <button 
                    onClick={() => {
                      setRestockSearchMonth(today.substring(0, 7));
                    }}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md text-sm font-bold hover:bg-blue-100 transition"
                  >
                    이번 달
                  </button>
               </div>
               {renderCalendar(restockSearchMonth, mapData, (dateStr) => {
                 setRestockSearchDate(dateStr);
                 setRestockViewType('daily');
               })}
            </div>
          );
        })()}
      </div>
    );
  };

  const renderSalesReportView = () => {
    const handleSort = (key) => {
      let direction = 'desc';
      if (salesReportSort.key === key && salesReportSort.direction === 'desc') direction = 'asc';
      setSalesReportSort({ key, direction });
    };

    const goToBusinessToday = () => {
      const d = getDefaultTransactionDateStr();
      setReportDate(d);
      setReportMonth(d.substring(0, 7));
    };

    const getDayOfWeek = (dateStr) => {
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return days[new Date(dateStr).getDay()];
    };

    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h2 className="text-2xl font-bold text-gray-800">매출 현황</h2>
          <div className="flex bg-gray-200 p-1 rounded-lg">
            <button 
              onClick={() => setSalesReportTab('daily')}
              className={`px-4 py-1.5 font-bold rounded-md transition-colors flex items-center ${salesReportTab === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List size={16} className="mr-1"/>일별 상세
            </button>
            <button 
              onClick={() => setSalesReportTab('monthly_list')}
              className={`px-4 py-1.5 font-bold rounded-md transition-colors flex items-center ${salesReportTab === 'monthly_list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BarChart size={16} className="mr-1"/>월별 목록
            </button>
            <button 
              onClick={() => setSalesReportTab('monthly_calendar')}
              className={`px-4 py-1.5 font-bold rounded-md transition-colors flex items-center ${salesReportTab === 'monthly_calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <CalendarDays size={16} className="mr-1"/>달력형
            </button>
          </div>
        </div>

        {salesReportTab === 'daily' ? (() => {
          const filteredDailySales = dailySales.filter(sale => sale.date === reportDate);
          const dailyTotalQty = filteredDailySales.reduce((sum, item) => sum + (item.type === '판매' ? item.qty : -item.qty), 0);
          const dailyNetTotal = filteredDailySales.reduce((sum, item) => {
            if (item.type === '판매') return sum + (item.actualPayment ?? 0) + (item.appliedBalance ?? 0);
            return sum - ((item.actualPayment ?? 0) + (item.appliedBalance ?? 0));
          }, 0);

          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                <div className="flex items-center space-x-3">
                  <h3 className="font-bold text-gray-800">제품 판매 내역</h3>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="date" 
                      value={reportDate} 
                      onChange={(e) => setReportDate(e.target.value)}
                      className="p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
                    />
                    <button 
                      type="button"
                      onClick={() => setReportDate(getDefaultTransactionDateStr())}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md text-sm font-bold hover:bg-blue-100 transition shadow-sm"
                      title="22시 이후는 익일 매출일자로 맞춤"
                    >
                      오늘
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto" onScroll={handleContainerScroll} ref={mainScrollRef}>
                <table className="w-full text-left relative">
                  <thead className="bg-gray-50 border-b sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-4 text-sm font-bold text-gray-600">시간</th>
                      <th className="p-4 text-sm font-bold text-gray-600">거래처</th>
                      <th className="p-4 text-sm font-bold text-gray-600">거래 내역 (클릭 시 상세)</th>
                      <th className="p-4 text-sm font-bold text-gray-600 text-center">구분</th>
                      <th className="p-4 text-sm font-bold text-gray-600 text-right">총 수량</th>
                      <th className="p-4 text-sm font-bold text-gray-600 text-right">상품금액</th>
                      <th className="p-4 text-sm font-bold text-gray-600 text-right">순매출액(잔고포함)</th>
                      <th className="p-4 text-sm font-bold text-gray-600 text-center">전체취소</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDailySales.map(sale => (
                      <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-sm text-gray-600">{sale.time}</td>
                        <td 
                          className="p-4 text-sm font-bold text-gray-800 cursor-pointer hover:text-blue-600 hover:underline"
                          onClick={() => {
                            const cust = customers.find(c => c.name === sale.customerName);
                            if(cust) handleGoToCustomerDetail(cust);
                          }}
                        >
                          {sale.customerName}
                        </td>
                        <td 
                          className="p-4 text-sm text-blue-600 font-bold cursor-pointer hover:underline"
                          onClick={() => setSaleDetailModal(sale)}
                          title="클릭하여 상세 구매 내역 보기 및 일부 삭제"
                        >
                          {getSaleDisplayProductName(products, sale)}
                        </td>
                        <td className="p-4 text-sm text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${sale.type === '판매' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                            {sale.type}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-medium text-right">{sale.qty}장</td>
                        <td className="p-4 text-sm font-medium text-gray-400 text-right">
                          ₩ {Math.abs(sale.total).toLocaleString()}
                        </td>
                        <td className={`p-4 text-sm font-bold text-right ${sale.type === '반품' ? 'text-gray-500' : 'text-blue-600'}`}>
                          {sale.type === '반품' && sale.actualPayment === 0 ? (
                            <span className="text-xs font-normal text-purple-500 block mb-0.5 whitespace-nowrap">예치금 적립</span>
                          ) : null}
                          ₩ {Math.abs((sale.actualPayment ?? 0) + (sale.appliedBalance ?? 0)).toLocaleString()}
                        </td>
                        <td className="p-4 text-sm text-center">
                          <button onClick={() => handleCancelSale(sale.id)} className="text-red-500 border border-red-200 bg-red-50 px-2 py-1 rounded text-xs hover:bg-red-100 font-bold transition shadow-sm">
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredDailySales.length === 0 && (
                      <tr><td colSpan="8" className="p-8 text-center text-gray-500">해당 날짜의 판매 내역이 없습니다.</td></tr>
                    )}
                  </tbody>
                  <tfoot className="bg-blue-50 border-t-2 border-blue-200 sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                    <tr>
                      <td colSpan="4" className="p-4 text-sm font-bold text-center text-gray-800">총 합계</td>
                      <td className="p-4 text-sm font-bold text-right text-gray-800">{dailyTotalQty}장</td>
                      <td className="p-4 text-sm font-bold text-right text-gray-400">
                        ₩ {Math.abs(filteredDailySales.reduce((s, i) => s + i.total, 0)).toLocaleString()}
                      </td>
                      <td className="p-4 text-sm font-bold text-right text-blue-600">₩ {dailyNetTotal.toLocaleString()}</td>
                      <td className="p-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })() : salesReportTab === 'monthly_list' ? (() => {
          const filteredMonthlySales = monthlySales.filter(day => day.date.startsWith(reportMonth));
          const sortedMonthlySales = [...filteredMonthlySales].sort((a, b) => {
            if (a[salesReportSort.key] < b[salesReportSort.key]) return salesReportSort.direction === 'asc' ? -1 : 1;
            if (a[salesReportSort.key] > b[salesReportSort.key]) return salesReportSort.direction === 'asc' ? 1 : -1;
            return 0;
          });
          const monthlyTotalCount = filteredMonthlySales.reduce((sum, item) => sum + item.count, 0);
          const monthlyTotalSales = filteredMonthlySales.reduce((sum, item) => sum + item.sales, 0);
          const monthlyTotalReturns = filteredMonthlySales.reduce((sum, item) => sum + item.returns, 0);
          const monthlyNetSales = filteredMonthlySales.reduce((sum, item) => sum + item.netSales, 0);

          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                <div className="flex items-center space-x-3">
                  <h3 className="font-bold text-gray-800">일자별 매출 요약</h3>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="month" 
                      value={reportMonth} 
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
                    />
                    <button 
                      type="button"
                      onClick={goToBusinessToday}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md text-sm font-bold hover:bg-blue-100 transition shadow-sm"
                      title="22시 이후는 익일 매출일자 기준으로 이번 달"
                    >
                      이번 달
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto" onScroll={handleContainerScroll} ref={mainScrollRef}>
                <table className="w-full text-left relative">
                  <thead className="bg-gray-50 border-b sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-4 text-sm font-bold text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('date')}>
                        일자 {salesReportSort.key === 'date' && (salesReportSort.direction === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="p-4 text-sm font-bold text-gray-600 text-right cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('count')}>
                        판매 건수 {salesReportSort.key === 'count' && (salesReportSort.direction === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="p-4 text-sm font-bold text-gray-600 text-right cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('sales')}>
                        총 판매액 {salesReportSort.key === 'sales' && (salesReportSort.direction === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="p-4 text-sm font-bold text-gray-600 text-right cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('returns')}>
                        반품액 {salesReportSort.key === 'returns' && (salesReportSort.direction === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="p-4 text-sm font-bold text-gray-600 text-right cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('netSales')}>
                        순매출액 {salesReportSort.key === 'netSales' && (salesReportSort.direction === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="p-4 text-sm font-bold text-gray-600 text-center">
                        관리
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedMonthlySales.map((day, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td 
                          className="p-4 text-sm font-bold text-blue-600 cursor-pointer hover:underline"
                          onClick={() => { setReportDate(day.date); setSalesReportTab('daily'); }}
                          title="클릭하여 일별 상세 매출 보기"
                        >
                          {day.date} ({getDayOfWeek(day.date)})
                        </td>
                        <td className="p-4 text-sm text-gray-600 text-right">{day.count}건</td>
                        <td className="p-4 text-sm text-gray-600 text-right">₩ {day.sales.toLocaleString()}</td>
                        <td className="p-4 text-sm text-red-500 text-right">₩ {day.returns.toLocaleString()}</td>
                        <td className="p-4 text-sm font-bold text-blue-600 text-right">₩ {day.netSales.toLocaleString()}</td>
                        <td className="p-4 text-sm text-center">
                          <button 
                            onClick={() => handleDeleteMonthlySaleRecord(day.date)} 
                            className="text-red-500 border border-red-200 bg-red-50 px-2 py-1 rounded text-[11px] hover:bg-red-100 font-bold transition whitespace-nowrap shadow-sm"
                          >
                            기록 삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sortedMonthlySales.length === 0 && (
                      <tr><td colSpan="6" className="p-8 text-center text-gray-500">해당 월의 매출 데이터가 없습니다.</td></tr>
                    )}
                  </tbody>
                  <tfoot className="bg-blue-50 border-t-2 border-blue-200 sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                    <tr>
                      <td className="p-4 text-sm font-bold text-center text-gray-800">총 합계</td>
                      <td className="p-4 text-sm font-bold text-right text-gray-800">{monthlyTotalCount}건</td>
                      <td className="p-4 text-sm font-bold text-right text-gray-800">₩ {monthlyTotalSales.toLocaleString()}</td>
                      <td className="p-4 text-sm font-bold text-right text-red-500">₩ {monthlyTotalReturns.toLocaleString()}</td>
                      <td className="p-4 text-sm font-bold text-right text-blue-600">₩ {monthlyNetSales.toLocaleString()}</td>
                      <td className="p-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })() : (() => {
          const currentMonthData = monthlySales.filter(m => m.date.startsWith(reportMonth));
          const totalMonthlySales = currentMonthData.reduce((sum, item) => sum + item.sales, 0);
          const totalMonthlyReturns = currentMonthData.reduce((sum, item) => sum + item.returns, 0);
          const totalMonthlyNetSales = currentMonthData.reduce((sum, item) => sum + item.netSales, 0);

          const mapData = {};
          currentMonthData.forEach(day => {
            mapData[day.date] = {
              content: (
                <>
                  <span className="text-gray-500">판매: {day.count}건</span>
                  <span className="text-blue-600 font-bold">순: ₩{day.netSales.toLocaleString()}</span>
                  {day.returns > 0 && <span className="text-red-500 font-medium">반: ₩{day.returns.toLocaleString()}</span>}
                </>
              )
            };
          });

          return (
            <div className="flex flex-col h-full overflow-y-auto" onScroll={handleContainerScroll} ref={mainScrollRef}>
               <div className="flex flex-wrap items-center gap-4 mb-4">
                 <div className="flex items-center space-x-3 bg-white p-3 rounded-lg shadow-sm border border-gray-100 w-max">
                    <h3 className="font-bold text-gray-800">월 선택</h3>
                    <input 
                      type="month" 
                      value={reportMonth} 
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
                    />
                    <button 
                      type="button"
                      onClick={goToBusinessToday}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md text-sm font-bold hover:bg-blue-100 transition shadow-sm"
                      title="22시 이후는 익일 매출일자 기준으로 이번 달"
                    >
                      이번 달
                    </button>
                 </div>

                 <div className="flex items-center bg-white p-3 rounded-lg shadow-sm border border-gray-100 gap-6">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 font-bold mb-0.5">총 판매액</span>
                      <span className="text-sm font-bold text-gray-800">₩ {totalMonthlySales.toLocaleString()}</span>
                    </div>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 font-bold mb-0.5">총 반품액</span>
                      <span className="text-sm font-bold text-red-500">₩ {totalMonthlyReturns.toLocaleString()}</span>
                    </div>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <div className="flex flex-col">
                      <span className="text-xs text-blue-600 font-bold mb-0.5">월 순매출액</span>
                      <span className="text-base font-black text-blue-700">₩ {totalMonthlyNetSales.toLocaleString()}</span>
                    </div>
                 </div>
               </div>
               
               {renderCalendar(reportMonth, mapData, (dateStr) => {
                 setReportDate(dateStr);
                 setSalesReportTab('daily');
               })}
            </div>
          );
        })()}
      </div>
    );
  };

  const renderProductStatsView = () => {
    const rangeFrom =
      productStatsRangeStart && productStatsRangeEnd
        ? (productStatsRangeStart <= productStatsRangeEnd ? productStatsRangeStart : productStatsRangeEnd)
        : '';
    const rangeTo =
      productStatsRangeStart && productStatsRangeEnd
        ? (productStatsRangeEnd >= productStatsRangeStart ? productStatsRangeEnd : productStatsRangeStart)
        : '';
    const periodLabel =
      rangeFrom && rangeTo ? `${rangeFrom} ~ ${rangeTo}` : '기간을 선택해 주세요';

    const setProductStatsThisMonth = () => {
      const mo = getTodayStr().substring(0, 7);
      setProductStatsRangeStart(getFirstDayOfMonthStr(mo));
      setProductStatsRangeEnd(getTodayStr());
    };

    const setProductStatsLastMonth = () => {
      const lm = getLastMonthStr();
      const [ly, lmn] = lm.split('-').map(Number);
      const lastDay = new Date(ly, lmn, 0).getDate();
      setProductStatsRangeStart(getFirstDayOfMonthStr(lm));
      setProductStatsRangeEnd(`${lm}-${String(lastDay).padStart(2, '0')}`);
    };

    const maxQty = productStatsTop10.length ? productStatsTop10[0].qty : 1;
    const barPalette = [
      'bg-blue-600',
      'bg-blue-500',
      'bg-indigo-600',
      'bg-indigo-500',
      'bg-violet-600',
      'bg-violet-500',
      'bg-sky-600',
      'bg-sky-500',
      'bg-cyan-600',
      'bg-cyan-500',
    ];

    return (
      <div className="p-6 h-full flex flex-col overflow-hidden">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 shrink-0 flex items-center">
          <BarChart className="mr-2 text-blue-600" size={28} />
          상품 통계
        </h2>
        <div className="mb-4 shrink-0 flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
          <span className="text-sm font-bold text-gray-700 shrink-0">시작일</span>
          <input
            type="date"
            value={productStatsRangeStart}
            onChange={(e) => setProductStatsRangeStart(e.target.value)}
            className="p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
          />
          <span className="text-sm font-bold text-gray-700 shrink-0">종료일</span>
          <input
            type="date"
            value={productStatsRangeEnd}
            onChange={(e) => setProductStatsRangeEnd(e.target.value)}
            className="p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
          />
          <button
            type="button"
            onClick={setProductStatsThisMonth}
            className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md text-sm font-bold hover:bg-blue-100 transition shadow-sm"
          >
            이번 달
          </button>
          <button
            type="button"
            onClick={setProductStatsLastMonth}
            className="px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-md text-sm font-bold hover:bg-gray-100 transition shadow-sm"
          >
            지난 달
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 shrink-0">
            <p className="text-sm text-gray-600">
              <span className="font-bold text-blue-700">{periodLabel}</span> · <span className="font-bold text-gray-800">판매(결제)</span> 건 기준, 상품코드별 판매 수량 합계 상위 10위입니다. 이름·색상은 상품 관리의 현재 정보를 따릅니다.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-5" onScroll={handleContainerScroll} ref={mainScrollRef}>
            {productStatsTop10.length === 0 ? (
              <div className="py-16 text-center text-gray-500 text-sm">
                {!(productStatsRangeStart && productStatsRangeEnd)
                  ? '시작일과 종료일을 선택해 주세요.'
                  : '선택한 기간에 집계할 판매 내역(라인 품목)이 없습니다.'}
              </div>
            ) : (
              <div className="flex w-full flex-row items-stretch justify-between gap-1 overflow-x-auto px-1 pb-4 pt-10 sm:gap-2 sm:px-2 sm:pt-14">
                {productStatsTop10.map((row, idx) => {
                  const pct = maxQty > 0 ? Math.round((row.qty / maxQty) * 1000) / 10 : 0;
                  const barClass = barPalette[idx] ?? 'bg-gray-500';
                  return (
                    <div
                      key={row.productId}
                      className="flex min-w-[4.25rem] w-0 flex-1 flex-col items-stretch sm:min-w-[5.25rem]"
                    >
                      <div className="mx-auto flex h-52 w-full max-w-[3.25rem] shrink-0 items-end justify-center overflow-hidden rounded-t-md bg-gray-200/80 sm:h-60 sm:max-w-[4rem]">
                        <div
                          className={`w-[72%] rounded-t-md ${barClass} transition-all duration-500`}
                          style={{ height: `${pct}%`, minHeight: pct > 0 ? 4 : 0 }}
                        />
                      </div>
                      <div className="mt-2 flex shrink-0 flex-col items-center gap-0.5 text-center">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-[10px] font-black text-white">
                          {idx + 1}
                        </span>
                        <div
                          className="line-clamp-2 h-[2.4rem] w-full overflow-hidden px-0.5 text-[10px] font-bold leading-tight text-gray-900 sm:h-[2.75rem] sm:text-xs"
                          title={`${row.displayName} · ${row.displayColor}`}
                        >
                          {row.displayName}
                        </div>
                        <div
                          className="line-clamp-2 w-full overflow-hidden px-0.5 text-[10px] font-bold leading-tight text-slate-700 sm:text-xs"
                          title={row.displayColor}
                        >
                          {row.displayColor}
                        </div>
                        <div className="font-mono text-[9px] text-gray-400">{row.productId}</div>
                        <div className="text-[10px] font-black text-blue-600 sm:text-xs tabular-nums">
                          {row.qty}
                          <span className="font-bold text-gray-600">장</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSalesStatsView = () => {
    const setSalesStatsThisMonth = () => {
      applySalesStatsDefaults(salesStatsTab);
    };

    const setSalesStatsLastMonth = () => {
      if (salesStatsTab === 'daily') {
        const lm = getLastMonthStr();
        const [ly, lmn] = lm.split('-').map(Number);
        const lastDay = new Date(ly, lmn, 0).getDate();
        setSalesStatsRangeStart(getFirstDayOfMonthStr(lm));
        setSalesStatsRangeEnd(`${lm}-${String(lastDay).padStart(2, '0')}`);
      } else if (salesStatsTab === 'monthly') {
        const y = String(Number(getTodayStr().substring(0, 4)) - 1);
        setSalesStatsMonthStart(`${y}-01`);
        setSalesStatsMonthEnd(`${y}-12`);
      } else {
        applySalesStatsDefaults('yearly');
      }
    };

    const rowsForScale = salesStatsRows.filter((r) => !r.isFuture);
    const maxAbsNet = rowsForScale.length
      ? Math.max(...rowsForScale.map((r) => Math.abs(r.netSales)), 1)
      : 1;
    const totalNet = salesStatsRows
      .filter((r) => !r.isFuture)
      .reduce((sum, r) => sum + r.netSales, 0);

    const periodLabel =
      salesStatsTab === 'daily'
        ? salesStatsRangeStart && salesStatsRangeEnd
          ? `${salesStatsRangeStart <= salesStatsRangeEnd ? salesStatsRangeStart : salesStatsRangeEnd} ~ ${salesStatsRangeEnd >= salesStatsRangeStart ? salesStatsRangeEnd : salesStatsRangeStart}`
          : '기간을 선택해 주세요'
        : salesStatsTab === 'monthly'
          ? `${salesStatsMonthStart <= salesStatsMonthEnd ? salesStatsMonthStart : salesStatsMonthEnd} ~ ${salesStatsMonthEnd >= salesStatsMonthStart ? salesStatsMonthEnd : salesStatsMonthStart}`
          : `${Math.min(Number(salesStatsYearStart), Number(salesStatsYearEnd))} ~ ${Math.max(Number(salesStatsYearStart), Number(salesStatsYearEnd))}년`;

    const unitLabel = salesStatsTab === 'daily' ? '일' : salesStatsTab === 'monthly' ? '월' : '연';

    return (
      <div className="p-6 h-full flex flex-col overflow-hidden">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 shrink-0 flex items-center">
          <LineChart className="mr-2 text-blue-600" size={28} />
          매출 통계
        </h2>

        <div className="mb-4 shrink-0 flex flex-wrap items-center gap-3">
          <div className="flex bg-gray-200 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setSalesStatsTab('daily')}
              className={`px-4 py-1.5 font-bold rounded-md transition-colors ${salesStatsTab === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              일별
            </button>
            <button
              type="button"
              onClick={() => setSalesStatsTab('monthly')}
              className={`px-4 py-1.5 font-bold rounded-md transition-colors ${salesStatsTab === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              월별
            </button>
            <button
              type="button"
              onClick={() => setSalesStatsTab('yearly')}
              className={`px-4 py-1.5 font-bold rounded-md transition-colors ${salesStatsTab === 'yearly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              연별
            </button>
          </div>
        </div>

        <div className="mb-4 shrink-0 flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
          {salesStatsTab === 'daily' && (
            <>
              <span className="text-sm font-bold text-gray-700 shrink-0">시작일</span>
              <input
                type="date"
                value={salesStatsRangeStart}
                onChange={(e) => setSalesStatsRangeStart(e.target.value)}
                className="p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
              />
              <span className="text-sm font-bold text-gray-700 shrink-0">종료일</span>
              <input
                type="date"
                value={salesStatsRangeEnd}
                onChange={(e) => setSalesStatsRangeEnd(e.target.value)}
                className="p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
              />
            </>
          )}
          {salesStatsTab === 'monthly' && (
            <>
              <span className="text-sm font-bold text-gray-700 shrink-0">시작월</span>
              <input
                type="month"
                value={salesStatsMonthStart}
                onChange={(e) => setSalesStatsMonthStart(e.target.value)}
                className="p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
              />
              <span className="text-sm font-bold text-gray-700 shrink-0">종료월</span>
              <input
                type="month"
                value={salesStatsMonthEnd}
                onChange={(e) => setSalesStatsMonthEnd(e.target.value)}
                className="p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
              />
            </>
          )}
          {salesStatsTab === 'yearly' && (
            <>
              <span className="text-sm font-bold text-gray-700 shrink-0">시작연도</span>
              <input
                type="number"
                min={2000}
                max={2099}
                value={salesStatsYearStart}
                onChange={(e) => setSalesStatsYearStart(e.target.value)}
                className="w-24 p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
              />
              <span className="text-sm font-bold text-gray-700 shrink-0">종료연도</span>
              <input
                type="number"
                min={2000}
                max={2099}
                value={salesStatsYearEnd}
                onChange={(e) => setSalesStatsYearEnd(e.target.value)}
                className="w-24 p-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
              />
            </>
          )}
          <button
            type="button"
            onClick={setSalesStatsThisMonth}
            className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md text-sm font-bold hover:bg-blue-100 transition shadow-sm"
          >
            {salesStatsTab === 'yearly' ? '전체(개업~현재)' : '이번 달'}
          </button>
          {salesStatsTab !== 'yearly' && (
            <button
              type="button"
              onClick={setSalesStatsLastMonth}
              className="px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-md text-sm font-bold hover:bg-gray-100 transition shadow-sm"
            >
              {salesStatsTab === 'monthly' ? '작년' : '지난 달'}
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 shrink-0 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              <span className="font-bold text-blue-700">{periodLabel}</span> ·{' '}
              <span className="font-bold text-gray-800">{unitLabel}별 순매출</span> (판매 − 반품, 결제+잔고차감 기준) ·{' '}
              {salesStatsTab === 'daily'
                ? '해당 월 전체(평일만, 토·일 제외) · 미래 일자는 공란'
                : '날짜 순'}
            </p>
            {salesStatsRows.length > 0 && (
              <p className="text-sm font-black text-blue-700 tabular-nums">
                합계 ₩ {totalNet.toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-5" onScroll={handleContainerScroll} ref={mainScrollRef}>
            {salesStatsRows.length === 0 ? (
              <div className="py-16 text-center text-gray-500 text-sm">
                {salesStatsTab === 'daily' && !(salesStatsRangeStart && salesStatsRangeEnd)
                  ? '시작일과 종료일을 선택해 주세요.'
                  : '선택한 기간에 집계할 매출 내역이 없습니다.'}
              </div>
            ) : (
              (() => {
                const barCount = salesStatsRows.length;
                const isDailyChart = salesStatsTab === 'daily';
                const isMonthlyChart = salesStatsTab === 'monthly';
                const useFluidBarGrid = isDailyChart || isMonthlyChart;
                const useCompactAmount = !isMonthlyChart && !useFluidBarGrid && barCount > 28;
                const barTrackMaxClass = isDailyChart
                  ? 'max-w-[3.25rem] sm:max-w-[3.5rem]'
                  : isMonthlyChart
                    ? 'max-w-[2.75rem] sm:max-w-[3.25rem]'
                    : 'max-w-[4.5rem] sm:max-w-[5rem]';
                const barInnerWidthClass = isMonthlyChart ? 'w-[72%]' : 'w-[78%]';
                const rows = salesStatsRows.map((row, idx) => {
                      const showBar = !row.isFuture && row.netSales !== 0;
                      const pct =
                        showBar && maxAbsNet > 0
                          ? Math.round((Math.abs(row.netSales) / maxAbsNet) * 1000) / 10
                          : 0;
                      const isNegative = row.netSales < 0;
                      const barColorClass = isNegative
                        ? 'bg-red-500'
                        : SALES_STATS_BAR_PALETTE[idx % SALES_STATS_BAR_PALETTE.length];
                      const amountLabel = row.isFuture
                        ? ''
                        : isDailyChart
                          ? (row.netSales === 0 ? '' : `₩${row.netSales}`)
                          : useCompactAmount
                            ? formatCompactWon(row.netSales)
                            : row.netSales === 0
                              ? '—'
                              : `₩${row.netSales.toLocaleString()}`;
                  return (
                    <div
                      key={row.label}
                      className={`flex min-w-0 flex-col items-stretch ${
                        useFluidBarGrid ? 'w-full' : 'w-[7rem] shrink-0 sm:w-[7.5rem]'
                      }`}
                      title={
                            row.isFuture
                              ? `${formatSalesStatsLabel(row.label, salesStatsTab)} · (미래)`
                              : `${formatSalesStatsLabel(row.label, salesStatsTab)} · ₩${row.netSales.toLocaleString()}`
                          }
                        >
                          <div
                            className={`mx-auto flex h-52 w-full items-end justify-center overflow-hidden rounded-t sm:h-60 ${barTrackMaxClass} ${
                              row.isFuture ? 'bg-gray-100' : 'bg-gray-200/80'
                            }`}
                          >
                            {showBar && (
                              <div
                                className={`${barInnerWidthClass} rounded-t transition-all duration-500 ${barColorClass}`}
                                style={{ height: `${pct}%`, minHeight: 4 }}
                              />
                            )}
                          </div>
                          <div className="mt-2 flex w-full flex-col items-center gap-0.5 px-px text-center leading-tight">
                            <div
                              className={`whitespace-nowrap font-bold text-gray-800 ${
                                isDailyChart
                                  ? 'text-[10px] sm:text-[11px]'
                                  : isMonthlyChart
                                    ? 'text-[10px] sm:text-[11px]'
                                    : 'text-[11px] sm:text-xs'
                              } ${row.isFuture ? 'text-gray-400' : ''}`}
                            >
                              {formatSalesStatsAxisLabel(row.label, salesStatsTab)}
                            </div>
                            <div
                              className={`whitespace-nowrap font-black tabular-nums ${
                                isMonthlyChart
                                  ? 'text-[10px] sm:text-[11px] tracking-tight'
                                  : isDailyChart
                                    ? 'text-[8px] sm:text-[9px] tracking-tight'
                                    : 'text-[10px] sm:text-[11px]'
                              } ${row.isFuture ? 'text-gray-300' : isNegative ? 'text-red-600' : 'text-blue-700'}`}
                            >
                          {amountLabel || (row.isFuture ? '' : '—')}
                            </div>
                          </div>
                    </div>
                  );
                });
                return (
                  <div className={`pb-4 pt-8 sm:pt-10 ${useFluidBarGrid ? '' : 'overflow-x-auto'}`}>
                    {useFluidBarGrid ? (
                      <div
                        className={`grid w-full px-1 ${
                          isMonthlyChart ? 'gap-0.5 sm:gap-1' : 'gap-0.5 sm:gap-1'
                        }`}
                        style={{ gridTemplateColumns: `repeat(${barCount}, minmax(0, 1fr))` }}
                      >
                        {rows}
                      </div>
                    ) : (
                      <div className="flex w-max min-w-full flex-row items-stretch justify-start gap-1.5 px-2 sm:gap-2">
                        {rows}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerView = () => {
    const customerListRegex = makeChosungRegex(customerSearchQuery);
    const toggleCustomerSort = (sortKey) => {
      setCustomerSort((prev) =>
        prev.key === sortKey
          ? { key: sortKey, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
          : { key: sortKey, direction: 'asc' }
      );
    };
    const filteredCustomers = customers.filter(c => {
      const isSalesCustomer = !c.type || c.type === '판매처' || c.type === '매출처';
      const typeMatch = customerListTab === '전체' || (customerListTab === '판매처' ? isSalesCustomer : c.type === '매입처');
      const searchMatch = customerListRegex.test(c.name) || c.id.toLowerCase().includes(customerSearchQuery.toLowerCase());
      return typeMatch && searchMatch;
    }).sort((a, b) => {
      const dir = customerSort.direction === 'asc' ? 1 : -1;
      switch (customerSort.key) {
        case 'id':
          return dir * a.id.localeCompare(b.id, undefined, { numeric: true });
        case 'type': {
          const rank = (c) => (!c.type || c.type === '판매처' || c.type === '매출처') ? 0 : 1;
          return dir * (rank(a) - rank(b));
        }
        case 'name':
          return dir * a.name.localeCompare(b.name, 'ko');
        case 'phone':
          return dir * String(a.phone ?? '').localeCompare(String(b.phone ?? ''), undefined, { numeric: true });
        case 'sales': {
          const salesA = customerTotalSales[a.name] || 0;
          const salesB = customerTotalSales[b.name] || 0;
          return dir * (salesA - salesB);
        }
        case 'balance':
          return dir * (a.balance - b.balance);
        default:
          return 0;
      }
    });

    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-gray-800">업체 내역</h2>
            <div className="flex bg-gray-200 p-1 rounded-lg">
              <button onClick={() => setCustomerListTab('전체')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${customerListTab === '전체' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>전체</button>
              <button onClick={() => setCustomerListTab('판매처')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${customerListTab === '판매처' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>판매처</button>
              <button onClick={() => setCustomerListTab('매입처')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${customerListTab === '매입처' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>매입처</button>
            </div>
          </div>
          <div className="flex space-x-3 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input 
                type="text" 
                lang="ko"
                style={{ imeMode: 'active' }}
                placeholder="업체명 초성 검색..." 
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(normalizeChosungSearchInput(e.target.value))}
                className="pl-10 pr-10 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-56 transition-shadow shadow-sm" 
              />
              {customerSearchQuery && (
                <button onClick={() => setCustomerSearchQuery('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomerMergeKeepId('');
                setCustomerMergeRemoveId('');
                setCustomerMergeModalOpen(true);
              }}
              className="bg-white text-gray-700 px-4 py-2 rounded-lg font-medium flex items-center hover:bg-gray-50 shadow-sm h-[38px] border border-gray-300"
            >
              <Merge size={18} className="mr-2 text-amber-600" /> 거래처 합치기
            </button>
            <button onClick={openAddCustomerModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center hover:bg-blue-700 shadow-sm h-[38px]">
              <Plus size={18} className="mr-2"/> 신규 등록
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto pb-28" onScroll={handleContainerScroll} ref={mainScrollRef}>
            <table className="w-full text-left relative">
              <thead className="bg-gray-50 border-b sticky top-0 z-10 shadow-sm">
                <tr>
                  <th
                    scope="col"
                    onClick={() => toggleCustomerSort('id')}
                    className={`p-4 text-sm font-bold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors ${customerSort.key === 'id' ? 'text-blue-700' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      업체코드
                      {customerSort.key === 'id' && (customerSort.direction === 'asc' ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />)}
                    </span>
                  </th>
                  <th
                    scope="col"
                    onClick={() => toggleCustomerSort('type')}
                    className={`p-4 text-sm font-bold text-gray-600 text-center cursor-pointer select-none hover:bg-gray-100 transition-colors ${customerSort.key === 'type' ? 'text-blue-700' : ''}`}
                  >
                    <span className="inline-flex items-center justify-center gap-1 w-full">
                      구분
                      {customerSort.key === 'type' && (customerSort.direction === 'asc' ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />)}
                    </span>
                  </th>
                  <th
                    scope="col"
                    onClick={() => toggleCustomerSort('name')}
                    className={`p-4 text-sm font-bold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors ${customerSort.key === 'name' ? 'text-blue-700' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      업체명 (상호)
                      {customerSort.key === 'name' && (customerSort.direction === 'asc' ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />)}
                    </span>
                  </th>
                  <th
                    scope="col"
                    onClick={() => toggleCustomerSort('phone')}
                    className={`p-4 text-sm font-bold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors ${customerSort.key === 'phone' ? 'text-blue-700' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      연락처
                      {customerSort.key === 'phone' && (customerSort.direction === 'asc' ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />)}
                    </span>
                  </th>
                  <th
                    scope="col"
                    onClick={() => toggleCustomerSort('sales')}
                    className={`p-4 text-sm font-bold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors ${customerSort.key === 'sales' ? 'text-blue-700' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      누적 거래액
                      {customerSort.key === 'sales' && (customerSort.direction === 'asc' ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />)}
                    </span>
                  </th>
                  <th
                    scope="col"
                    onClick={() => toggleCustomerSort('balance')}
                    className={`p-4 text-sm font-bold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors ${customerSort.key === 'balance' ? 'text-blue-700' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      보유 잔고 (예치금)
                      {customerSort.key === 'balance' && (customerSort.direction === 'asc' ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />)}
                    </span>
                  </th>
                  <th className="p-4 text-sm font-bold text-gray-600 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-sm font-medium text-gray-900">{c.id}</td>
                    <td className="p-4 text-sm text-center">
                      <span className={`px-2 py-1 rounded text-[11px] font-bold ${(!c.type || c.type === '판매처' || c.type === '매출처') ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                        {(!c.type || c.type === '판매처' || c.type === '매출처') ? '판매처' : '매입처'}
                      </span>
                    </td>
                    <td 
                      className="p-4 text-sm font-bold text-gray-800 cursor-pointer hover:underline hover:text-blue-600"
                      onClick={() => handleGoToCustomerDetail(c)}
                    >
                      {c.name}
                    </td>
                    <td className="p-4 text-sm text-gray-600">{c.phone}</td>
                    
                    <td className="p-4 text-sm font-bold text-gray-600">
                      ₩ {(customerTotalSales[c.name] || 0).toLocaleString()}
                    </td>

                    <td className="p-4 text-sm font-bold"><span className={c.balance > 0 ? 'text-blue-600' : 'text-gray-800'}>₩ {c.balance.toLocaleString()}</span></td>
                    <td className="p-4 text-sm text-center whitespace-nowrap">
                      <button onClick={() => handleGoToCustomerDetail(c, true)} className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1.5 rounded text-xs mr-2 border border-blue-100 shadow-sm">수정</button>
                      <button onClick={() => handleDeleteCustomer(c.id)} className="text-red-500 hover:text-red-700 font-medium bg-red-50 px-3 py-1.5 rounded text-xs border border-red-100 shadow-sm">삭제</button>
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (
                  <tr><td colSpan="8" className="p-8 text-center text-gray-500">검색 결과가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerDetailView = ({ inModal = false } = {}) => {
    if (!selectedCustomerDetail) return null;

    const handleSaveEdit = () => {
      if (!customerEditForm.name) return showAlert("거래처명(상호)을 입력해주세요.");
      
      const oldName = selectedCustomerDetail.name;
      const updated = { ...customerEditForm, balance: Number(customerEditForm.balance) };
      setCustomers(customers.map(c => c.id === updated.id ? updated : c));
      saveItem('customers', updated); 
      
      if (oldName !== updated.name) {
        renameCustomerNameInAllRecords(oldName, updated.name);
      }

      setSelectedCustomerDetail(updated);
      setCustomerDetailEditMode(false);
      showAlert('거래처 정보가 성공적으로 수정되었습니다.');
    };

    const displayType = (!selectedCustomerDetail.type || selectedCustomerDetail.type === '판매처' || selectedCustomerDetail.type === '매출처') ? '판매처' : '매입처';
    const customerSales = dailySales.filter(sale => sale.customerName === selectedCustomerDetail.name);
    const totalAccumulated = customerTotalSales[selectedCustomerDetail.name] || 0;

    return (
      <div className={inModal ? 'p-5 flex flex-col min-h-0 w-full max-w-4xl' : 'px-6 pb-6 pt-2 h-full flex flex-col'}>
        <div className="flex items-center justify-between mb-6 shrink-0 gap-3">
          <div className="flex items-center min-w-0">
            <h2 className="text-2xl font-bold text-gray-800">거래처 상세 정보</h2>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {customerDetailEditMode ? (
              <>
                <button onClick={() => setCustomerDetailEditMode(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium shadow-sm">취소</button>
                <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">수정사항 저장</button>
              </>
            ) : (
              <>
                <button onClick={() => { setCustomerEditForm(selectedCustomerDetail); setCustomerDetailEditMode(true); }} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium shadow-sm">수정</button>
                <button onClick={() => handleDeleteCustomer(selectedCustomerDetail.id)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium shadow-sm">삭제</button>
              </>
            )}
            {inModal && (
              <button type="button" onClick={closeCustomerDetailModal} className="px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 font-medium shadow-sm">
                닫기
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 w-full flex flex-col overflow-hidden">
          {customerDetailEditMode ? (
            <div className={`space-y-6 pr-2 ${inModal ? '' : 'overflow-y-auto'}`} onScroll={inModal ? undefined : handleContainerScroll} ref={inModal ? undefined : mainScrollRef}>
              <div className="flex items-center space-x-6 pb-4 border-b border-gray-100">
                <span className="text-sm font-bold text-gray-700">업체 구분</span>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" name="type" value="판매처" checked={!customerEditForm.type || customerEditForm.type === '판매처' || customerEditForm.type === '매출처'} onChange={e => setCustomerEditForm({...customerEditForm, type: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-700">판매처</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" name="type" value="매입처" checked={customerEditForm.type === '매입처'} onChange={e => setCustomerEditForm({...customerEditForm, type: e.target.value})} className="text-purple-600 focus:ring-purple-500" />
                  <span className="text-sm font-medium text-gray-700">매입처</span>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">거래처명 (상호) *</label>
                  <input type="text" lang="ko" style={{ imeMode: 'active' }} value={customerEditForm.name} onChange={e => setCustomerEditForm({...customerEditForm, name: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">연락처</label>
                  <input type="text" value={customerEditForm.phone} onChange={e => setCustomerEditForm({...customerEditForm, phone: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">사업자번호</label>
                  <input type="text" value={customerEditForm.bizNum} onChange={e => setCustomerEditForm({...customerEditForm, bizNum: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">보유 잔고 (원)</label>
                  <input type="number" value={customerEditForm.balance} onChange={e => setCustomerEditForm({...customerEditForm, balance: e.target.value})} onWheel={preventMoneyInputWheel} className="input-money-no-spin w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">메모 (참고사항)</label>
                <textarea lang="ko" style={{ imeMode: 'active' }} value={customerEditForm.memo} onChange={e => setCustomerEditForm({...customerEditForm, memo: e.target.value})} rows="3" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="space-y-6 shrink-0 pb-6">
                <div className="border-b pb-6 flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">{selectedCustomerDetail.id}</span>
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${displayType === '판매처' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                        {displayType}
                      </span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">{selectedCustomerDetail.name}</h1>
                  </div>
                  <div className="text-right flex space-x-8">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">누적 순거래액</p>
                      <p className="text-xl font-bold text-gray-700">₩ {totalAccumulated.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">보유 잔고(예치금)</p>
                      <p className={`text-2xl font-bold ${selectedCustomerDetail.balance > 0 ? 'text-blue-600' : 'text-gray-800'}`}>₩ {selectedCustomerDetail.balance.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">연락처</p>
                    <p className="font-medium text-gray-900">{selectedCustomerDetail.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">사업자번호</p>
                    <p className="font-medium text-gray-900">{selectedCustomerDetail.bizNum || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500 mb-1">메모</p>
                    <p className="font-medium text-gray-900 whitespace-pre-wrap">{selectedCustomerDetail.memo || '없음'}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex-1 flex flex-col min-h-[250px] overflow-hidden">
                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center shrink-0">
                  <FileText className="mr-2 text-gray-500" size={20} /> 과거 거래 내역 모아보기
                </h3>
                <div className="border border-gray-200 rounded-lg flex-1 overflow-y-auto relative" onScroll={handleContainerScroll} ref={mainScrollRef}>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="p-3 font-medium text-gray-600">일자 / 시간</th>
                        <th className="p-3 font-medium text-gray-600 text-center">구분</th>
                        <th className="p-3 font-medium text-gray-600">거래 내용 (클릭 시 상세 팝업)</th>
                        <th className="p-3 font-medium text-gray-600 text-right">수량</th>
                        <th className="p-3 font-medium text-gray-600 text-right">결제 / 반품액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {customerSales.map(sale => (
                        <tr 
                          key={sale.id} 
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                          onClick={() => setSaleDetailModal(sale)} 
                        >
                          <td className="p-3 text-gray-600">{sale.date} {sale.time}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded text-[11px] font-bold ${sale.type === '판매' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                              {sale.type}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-blue-600 hover:underline">{getSaleDisplayProductName(products, sale)}</td>
                          <td className="p-3 font-medium text-right">{sale.qty}장</td>
                          <td className={`p-3 font-bold text-right ${sale.type === '판매' ? 'text-gray-800' : 'text-gray-500'}`}>
                            ₩ {Math.abs((sale.actualPayment ?? 0) + (sale.appliedBalance ?? 0)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {customerSales.length === 0 && (
                        <tr><td colSpan="5" className="p-6 text-center text-gray-500">과거 거래 내역이 없습니다.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAddCustomerView = ({ inModal = false } = {}) => {
    const handleAddCustomerChange = (e) => {
      const { name, value } = e.target;
      if (name === 'phone') {
        setAddCustomerForm({ ...addCustomerForm, phone: formatPhoneHyphens(value) });
        return;
      }
      setAddCustomerForm({ ...addCustomerForm, [name]: value });
    };

    const duplicateExisting = findCustomerWithExactName(customers, addCustomerForm.name);
    const showDuplicateNameWarning = !!duplicateExisting;

    const completeAddCustomerRegistration = () => {
      let maxCustIdNum = 0;
      customers.forEach(c => {
        const match = c.id.match(/^C0*(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxCustIdNum) maxCustIdNum = num;
        }
      });
      const nextCustNum = maxCustIdNum > 0 ? maxCustIdNum + 1 : customers.length + 1;
      const newId = `C${String(nextCustNum).padStart(4, '0')}`;

      const newCustomer = {
        id: newId,
        type: addCustomerForm.type,
        name: addCustomerForm.name.trim(),
        phone: addCustomerForm.phone,
        bizNum: addCustomerForm.bizNum,
        memo: addCustomerForm.memo,
        balance: 0,
      };
      setCustomers([...customers, newCustomer]);
      saveItem('customers', newCustomer);

      showAlert(`[${newCustomer.name}] 거래처가 성공적으로 등록되었습니다.\n(거래처코드: ${newId})`, () => {
        setAddCustomerForm({ type: '판매처', name: '', phone: '', bizNum: '', memo: '' });
        if (inModal) closeAddCustomerModal();
        else goBack();
      });
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!addCustomerForm.name.trim()) return showAlert("거래처명(상호)을 입력해주세요.");

      if (duplicateExisting) {
        showConfirm(
          `${DUPLICATE_CUSTOMER_NAME_MSG}\n\n그래도 새로 등록하시겠습니까?`,
          completeAddCustomerRegistration
        );
        return;
      }

      completeAddCustomerRegistration();
    };

    const handleCustomerFormKeyDown = (e) => {
      if (e.key === 'Enter' && !modalConfig.isOpen) {
        if (e.target.name === 'memo' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
        
        e.preventDefault();
        const form = e.currentTarget;
        const inputs = Array.from(form.querySelectorAll('input:not([type="radio"]), select, textarea, button[type="submit"]'));
        const index = inputs.indexOf(e.target);
        
        if (index > -1 && index < inputs.length - 1) {
             const nextEl = inputs[index + 1];
             nextEl.focus();
             if (nextEl.tagName === 'INPUT') setTimeout(() => nextEl.select(), 10);
        }
      }
    };

    const cancelAddCustomer = inModal ? closeAddCustomerModal : goBack;

    return (
      <div className={inModal ? '' : 'px-6 pb-6 pt-2 overflow-y-auto'} onScroll={!inModal ? handleContainerScroll : undefined} ref={!inModal ? mainScrollRef : undefined}>
        {!inModal && (
          <div className="flex items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">신규 거래처 등록</h2>
          </div>
        )}
        <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${inModal ? 'border-0 shadow-none' : 'max-w-2xl'}`}>
          <form onSubmit={handleSubmit} onKeyDown={handleCustomerFormKeyDown} className="space-y-6">
            <div className="flex items-center space-x-6 pb-4 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-700">업체 구분</span>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" name="type" value="판매처" checked={addCustomerForm.type === '판매처'} onChange={handleAddCustomerChange} className="text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-medium text-gray-700">판매처</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" name="type" value="매입처" checked={addCustomerForm.type === '매입처'} onChange={handleAddCustomerChange} className="text-purple-600 focus:ring-purple-500" />
                <span className="text-sm font-medium text-gray-700">매입처</span>
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">거래처명 (상호) *</label>
                <input
                  type="text"
                  name="name"
                  lang="ko"
                  style={{ imeMode: 'active' }}
                  value={addCustomerForm.name}
                  onChange={handleAddCustomerChange}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${showDuplicateNameWarning ? 'border-red-400' : 'border-gray-300'}`}
                />
                {showDuplicateNameWarning && (
                  <p className="mt-1.5 text-sm font-medium text-red-600">{DUPLICATE_CUSTOMER_NAME_MSG}</p>
                )}
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">연락처</label><input type="text" name="phone" inputMode="numeric" autoComplete="tel" placeholder="010-0000-0000" value={addCustomerForm.phone} onChange={handleAddCustomerChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-2">사업자번호</label><input type="text" name="bizNum" value={addCustomerForm.bizNum} onChange={handleAddCustomerChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">메모 (참고사항)</label><textarea name="memo" lang="ko" style={{ imeMode: 'active' }} value={addCustomerForm.memo} onChange={handleAddCustomerChange} rows="3" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="엔터키는 줄바꿈, 다음 칸 이동은 탭(Tab)키를 이용하세요."></textarea></div>
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button type="button" onClick={cancelAddCustomer} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium" tabIndex="-1">취소</button>
              <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md">거래처 등록</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const handleUpdateMisongShippedQty = (id, val) => {
    setMisongList(prev => prev.map(item => {
      if (item.id === id) {
        let newVal = Number(val);
        if (newVal < 0) newVal = 0;
        if (newVal > item.qty) newVal = item.qty;

        const product = products.find(p => p.id === item.productId);
        const currentStock = product ? product.stock : 0;
        const availableToAdd = currentStock + item.savedShippedQty;

        if (newVal > availableToAdd) {
           showAlert(`출고 가능한 재고가 부족합니다.\n(현재 남은 재고: ${currentStock}장)`);
           return { ...item, shippedQty: availableToAdd }; 
        }
        return { ...item, shippedQty: newVal };
      }
      return item;
    }));
  };

  const handleUpdateSampleReturnedQty = (id, val) => {
    setSampleList(prev => prev.map(item => {
      if (item.id === id) {
        let newVal = Number(val);
        if (newVal < 0) newVal = 0;
        if (newVal > item.qty) newVal = item.qty; 
        return { ...item, returnedQty: newVal };
      }
      return item;
    }));
  };

  const handleSaveItemStatus = (item, isMisong) => {
    let stockDelta = 0;

    if (isMisong) {
      if (item.shippedQty === item.savedShippedQty) return;
      stockDelta = -(item.shippedQty - item.savedShippedQty); 
      
      if (stockDelta !== 0) {
        const updatedProduct = products.find(p => p.id === item.productId);
        if (updatedProduct) {
          const newProduct = { ...updatedProduct, stock: Math.max(0, updatedProduct.stock + stockDelta) };
          setProducts(products.map(p => p.id === item.productId ? newProduct : p));
          saveItem('products', newProduct); 
        }
      }
      
      const updatedMisong = { ...item, savedShippedQty: item.shippedQty };
      setMisongList(misongList.map(m => m.id === item.id ? updatedMisong : m));
      saveItem('misong', updatedMisong); 
      showAlert(`출고 수량이 저장되었습니다.${stockDelta !== 0 ? `\n(재고 ${stockDelta > 0 ? '+' : ''}${stockDelta}장 반영 완료)` : ''}`);
    } else {
      if (item.returnedQty === item.savedReturnedQty) return;
      stockDelta = item.returnedQty - item.savedReturnedQty; 
      
      if (stockDelta !== 0) {
        const updatedProduct = products.find(p => p.id === item.productId);
        if (updatedProduct) {
          const newProduct = { ...updatedProduct, stock: Math.max(0, updatedProduct.stock + stockDelta) };
          setProducts(products.map(p => p.id === item.productId ? newProduct : p));
          saveItem('products', newProduct); 
        }
      }
      const updatedSample = { ...item, savedReturnedQty: item.returnedQty };
      setSampleList(sampleList.map(s => s.id === item.id ? updatedSample : s));
      saveItem('samples', updatedSample); 
      showAlert(`회수 수량이 저장되었습니다.\n(재고 ${stockDelta > 0 ? '+' : ''}${stockDelta}장 반영 완료)`);
    }
  };

  const handleSaveItemStatusClick = (item, isMisong) => {
    if (isMisong) {
      if (item.shippedQty === item.qty && item.savedShippedQty !== item.qty) {
        showConfirm("전체 수량이 출고되어 '출고 완료' 처리됩니다.\n저장 후에는 완료 내역으로 이동되며, 더 이상 수정할 수 일없습니다.\n계속하시겠습니까?", () => {
          handleSaveItemStatus(item, isMisong);
        });
        return;
      }
    } else {
      if (item.returnedQty === item.qty && item.savedReturnedQty !== item.qty) {
        showConfirm("전체 수량이 회수되어 '회수 완료' 처리됩니다.\n저장 후에는 완료 내역으로 이동되며, 더 이상 수정할 수 없습니다.\n계속하시겠습니까?", () => {
          handleSaveItemStatus(item, isMisong);
        });
        return;
      }
    }
    handleSaveItemStatus(item, isMisong);
  };

  const handleRevertCompletedItem = (item, isMisong) => {
    const typeLabel = isMisong ? '미송(출고)' : '샘플(회수)';
    showConfirm(
      `[${item.customerName}] ${getMisongSampleProductName(products, item)}\n${typeLabel} 완료 처리를 취소하고 진행 중 목록으로 되돌리시겠습니까?\n(마지막으로 반영된 1장분 재고는 원복됩니다.)`,
      () => {
        const prevSaved = isMisong ? item.savedShippedQty : item.savedReturnedQty;
        const newSaved = Math.max(0, item.qty - 1);
        if (newSaved >= item.qty) {
          showAlert('되돌릴 수 있는 완료 내역이 없습니다.');
          return;
        }

        const stockDelta = isMisong ? prevSaved - newSaved : newSaved - prevSaved;

        if (stockDelta !== 0) {
          const updatedProduct = products.find(p => p.id === item.productId);
          if (updatedProduct) {
            const newProduct = { ...updatedProduct, stock: Math.max(0, updatedProduct.stock + stockDelta) };
            setProducts(products.map(p => p.id === item.productId ? newProduct : p));
            saveItem('products', newProduct);
          }
        }

        if (isMisong) {
          const reverted = {
            ...item,
            savedShippedQty: newSaved,
            shippedQty: newSaved,
          };
          setMisongList(misongList.map(m => (m.id === item.id ? reverted : m)));
          saveItem('misong', reverted);
        } else {
          const reverted = {
            ...item,
            savedReturnedQty: newSaved,
            returnedQty: newSaved,
          };
          setSampleList(sampleList.map(s => (s.id === item.id ? reverted : s)));
          saveItem('samples', reverted);
        }

        showAlert(`${typeLabel} 내역이 진행 중 목록으로 되돌려졌습니다.\n(출고·회수 수량을 다시 수정할 수 있습니다.)`);
      }
    );
  };

  const handleDeleteItem = (item, isMisong) => {
    showConfirm("정말 삭제하시겠습니까? (반영된 재고는 원래대로 복구됩니다)", () => {
      let stockDelta = 0;
      if (isMisong) {
        stockDelta = item.savedShippedQty;
      } else {
        stockDelta = item.qty - item.savedReturnedQty;
      }

      if (stockDelta !== 0) {
        const updatedProduct = products.find(p => p.id === item.productId);
        if (updatedProduct) {
          const newProduct = { ...updatedProduct, stock: Math.max(0, updatedProduct.stock + stockDelta) };
          setProducts(products.map(p => p.id === item.productId ? newProduct : p));
          saveItem('products', newProduct); 
        }
      }

      if (isMisong) {
        setMisongList(misongList.filter(m => m.id !== item.id));
        deleteItem('misong', item.id); 
      } else {
        setSampleList(sampleList.filter(s => s.id !== item.id));
        deleteItem('samples', item.id); 
      }
    });
  };

  const renderMisongView = () => {
    const activeMisongList = misongList.filter(m => m.savedShippedQty < m.qty);
    const activeSampleList = sampleList.filter(s => s.savedReturnedQty < s.qty);
    
    const completedMisong = misongList.filter(m => m.savedShippedQty >= m.qty).map(m => ({ ...m, _type: '미송' }));
    const completedSample = sampleList.filter(s => s.savedReturnedQty >= s.qty).map(s => ({ ...s, _type: '샘플' }));
    const completedList = [...completedMisong, ...completedSample].sort((a, b) => b.id.localeCompare(a.id));

    let currentList = [];
    if (misongTab === 'misong') currentList = activeMisongList;
    else if (misongTab === 'sample') currentList = activeSampleList;
    else if (misongTab === 'completed') currentList = completedList;

    const isMisong = misongTab === 'misong';
    const isCompleted = misongTab === 'completed';

    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h2 className="text-2xl font-bold text-gray-800">미송 / 샘플 내역</h2>
          <div className="flex bg-gray-200 p-1 rounded-lg">
             <button onClick={() => setMisongTab('misong')} className={`px-4 py-1.5 font-bold rounded-md transition-colors ${misongTab === 'misong' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>진행중 미송</button>
             <button onClick={() => setMisongTab('sample')} className={`px-4 py-1.5 font-bold rounded-md transition-colors ${misongTab === 'sample' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>진행중 샘플</button>
             <button onClick={() => setMisongTab('completed')} className={`px-4 py-1.5 font-bold rounded-md transition-colors ${misongTab === 'completed' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>완료 내역</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto" onScroll={handleContainerScroll} ref={mainScrollRef}>
            <table className="w-full text-left relative">
              <thead className="bg-gray-50 border-b sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-4 text-sm font-bold text-gray-600">접수일자</th>
                  <th className="p-4 text-sm font-bold text-gray-600">거래처명</th>
                  <th className="p-4 text-sm font-bold text-gray-600">상품정보</th>
                  {isCompleted && <th className="p-4 text-sm font-bold text-gray-600 text-center">구분</th>}
                  <th className="p-4 text-sm font-bold text-gray-600">{isMisong ? '전체 / 출고 수량' : isCompleted ? '전체 수량' : '출고 / 회수 수량'}</th>
                  <th className="p-4 text-sm font-bold text-gray-600 text-center w-28">상태</th>
                  <th className="p-4 text-sm font-bold text-gray-600 text-center w-32">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentList.map(item => {
                  const pInfo = products.find(p => p.id === item.productId);
                  const currentStock = pInfo ? pInfo.stock : 0;
                  
                  return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-900">{item.date}</td>
                    <td className="p-4 text-sm font-bold text-gray-800">{item.customerName}</td>
                    <td className="p-4 text-sm text-gray-600">{getMisongSampleProductName(products, item)}</td>
                    
                    {isCompleted ? (
                      <>
                        <td className="p-4 text-sm text-center">
                          <span className={`px-2 py-1 rounded text-[11px] font-bold ${item._type === '미송' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                            {item._type}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-medium">
                          <span className="text-gray-800 font-bold">{item.qty}장</span>
                        </td>
                        <td className="p-4 text-sm align-middle text-center">
                          <span className="bg-gray-100 text-gray-600 px-2 py-1.5 rounded text-xs font-bold border border-gray-200 block w-24 mx-auto">
                            {item._type === '미송' ? '출고완료' : '회수완료'}
                          </span>
                        </td>
                      </>
                    ) : isMisong ? (
                      <>
                        <td className="p-4 text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500 min-w-[50px]">전체: <b className="text-gray-800">{item.qty}</b></span>
                            <span className="text-gray-300">|</span>
                            <div className="flex items-center">
                              <span className="text-gray-500 mr-1">출고:</span>
                              <input 
                                type="number" 
                                min="0" max={item.qty} 
                                value={item.shippedQty === 0 ? '' : item.shippedQty} 
                                placeholder="0"
                                onChange={(e) => handleUpdateMisongShippedQty(item.id, e.target.value)} 
                                className="w-14 p-1 border border-gray-300 rounded text-right outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-600" 
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm align-middle">
                          <div className="flex flex-col gap-1 items-center justify-center">
                            {currentStock === 0 ? (
                              <span className="bg-orange-50 text-orange-600 px-2 py-1 rounded text-[11px] font-bold border border-orange-200 w-24 text-center inline-block">재고없음</span>
                            ) : (
                              <span className="bg-green-50 text-green-600 px-2 py-1 rounded text-[11px] font-bold border border-green-200 w-24 text-center inline-block">재고있음 ({currentStock})</span>
                            )}
                            {item.shippedQty === 0 ? (
                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[11px] font-bold border border-gray-200 w-24 text-center inline-block">출고예정</span>
                            ) : item.shippedQty < item.qty ? (
                              <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[11px] font-bold border border-blue-200 w-24 text-center inline-block">부분출고</span>
                            ) : null}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500 min-w-[50px]">출고: <b className="text-gray-800">{item.qty}</b></span>
                            <span className="text-gray-300">|</span>
                            <div className="flex items-center">
                              <span className="text-gray-500 mr-1">회수:</span>
                              <input 
                                type="number" 
                                min="0" max={item.qty} 
                                value={item.returnedQty === 0 ? '' : item.returnedQty} 
                                placeholder="0"
                                onChange={(e) => handleUpdateSampleReturnedQty(item.id, e.target.value)} 
                                className="w-14 p-1 border border-gray-300 rounded text-right outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-600" 
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm align-middle">
                          <div className="flex justify-center">
                            {item.returnedQty === 0 ? (
                              <span className="bg-gray-100 text-gray-600 px-2 py-1.5 rounded text-xs font-bold border border-gray-200 w-24 text-center inline-block">출고완료</span>
                            ) : item.returnedQty < item.qty ? (
                              <span className="bg-blue-50 text-blue-600 px-2 py-1.5 rounded text-xs font-bold border border-blue-200 w-24 text-center inline-block">부분회수</span>
                            ) : null}
                          </div>
                        </td>
                      </>
                    )}
                    
                    <td className="p-4 text-sm align-middle">
                      <div className="flex space-x-2 justify-center">
                        {!isCompleted && (
                          <button 
                            onClick={() => handleSaveItemStatusClick(item, isMisong)} 
                            disabled={isMisong ? item.shippedQty === item.savedShippedQty : item.returnedQty === item.savedReturnedQty} 
                            className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
                              (isMisong ? item.shippedQty === item.savedShippedQty : item.returnedQty === item.savedReturnedQty) 
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                                : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600 shadow-sm'
                            }`}
                          >
                            저장
                          </button>
                        )}
                        {isCompleted ? (
                          <button
                            type="button"
                            onClick={() => handleRevertCompletedItem(item, item._type === '미송')}
                            className="px-3 py-1.5 rounded text-xs font-bold border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors shadow-sm whitespace-nowrap"
                          >
                            되돌리기
                          </button>
                        ) : (
                          <button onClick={() => handleDeleteItem(item, isMisong)} className="text-red-500 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-50 border border-red-200 transition-colors shadow-sm">삭제</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
                })}
                {currentList.length === 0 && (<tr><td colSpan={isCompleted ? "7" : "6"} className="p-8 text-center text-gray-500">내역이 없습니다.</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCashView = () => {
    const handleCashSubmit = (e) => {
      e.preventDefault();
      if (!cashForm.amount || isNaN(Number(cashForm.amount)) || Number(cashForm.amount) <= 0) {
        return showAlert("올바른 금액을 입력하세요.");
      }
      
      const now = new Date();
      const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      const newLog = {
        id: `CASH_${Date.now()}`,
        date: getTodayStr(),
        time: timeStr,
        type: cashForm.type,
        amount: Number(cashForm.amount),
        memo: cashForm.memo
      };
      
      setCashLogs([newLog, ...cashLogs]);
      saveItem('cashLogs', newLog);
      setCashForm({ type: '입금', amount: '', memo: '' });
      showAlert(`${cashForm.type} 처리가 완료되었습니다.`);
    };

    const handleDeleteCashLog = (id) => {
      showConfirm('해당 시재 내역을 삭제하시겠습니까?\n(현재 시재 잔액이 즉시 재계산됩니다.)', () => {
        setCashLogs(prev => prev.filter(c => c.id !== id));
        deleteItem('cashLogs', id);
      });
    }

    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h2 className="text-2xl font-bold text-gray-800">시재 관리</h2>
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100 flex items-center">
            <Wallet className="mr-3 text-blue-500" size={24} />
            <div className="text-right">
              <p className="text-xs text-gray-500 font-bold">현재 보유 시재 (현금)</p>
              <p className="text-xl font-bold text-gray-900">₩ {currentCashBalance.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
          <div className="w-full md:w-1/3 shrink-0">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">시재 입/출금 등록</h3>
              <form onSubmit={handleCashSubmit} className="space-y-4">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" name="cashType" value="입금" checked={cashForm.type === '입금'} onChange={(e) => setCashForm({...cashForm, type: e.target.value})} className="text-blue-600 focus:ring-blue-500" />
                    <span className="ml-2 font-medium text-sm text-gray-700">입금</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" name="cashType" value="출금" checked={cashForm.type === '출금'} onChange={(e) => setCashForm({...cashForm, type: e.target.value})} className="text-red-600 focus:ring-red-500" />
                    <span className="ml-2 font-medium text-sm text-gray-700">출금</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">금액 (원)</label>
                  <input type="number" value={cashForm.amount} onChange={(e) => setCashForm({...cashForm, amount: e.target.value})} onWheel={preventMoneyInputWheel} placeholder="예) 50000" className="input-money-no-spin w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">메모 (적요)</label>
                  <input type="text" lang="ko" style={{ imeMode: 'active' }} value={cashForm.memo} onChange={(e) => setCashForm({...cashForm, memo: e.target.value})} placeholder="예) 식대, 거스름돈 추가" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
                <button type="submit" className={`w-full py-3 rounded-lg font-bold text-white shadow-sm transition ${cashForm.type === '입금' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-500 hover:bg-red-600'}`}>
                  {cashForm.type} 등록
                </button>
              </form>
            </div>
          </div>

          <div className="w-full md:w-2/3 bg-white rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-gray-50 shrink-0">
               <h3 className="font-bold text-gray-800">최근 시재 내역</h3>
            </div>
            <div className="flex-1 overflow-y-auto" onScroll={handleContainerScroll} ref={mainScrollRef}>
              <table className="w-full text-left relative">
                <thead className="bg-white border-b sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-3 text-sm font-bold text-gray-600">일시</th>
                    <th className="p-3 text-sm font-bold text-gray-600 text-center">구분</th>
                    <th className="p-3 text-sm font-bold text-gray-600 text-right">금액</th>
                    <th className="p-3 text-sm font-bold text-gray-600">메모</th>
                    <th className="p-3 text-sm font-bold text-gray-600 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cashLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="p-3 text-sm text-gray-500">{log.date} {log.time}</td>
                      <td className="p-3 text-sm text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${log.type === '입금' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                          {log.type}
                        </span>
                      </td>
                      <td className={`p-3 text-sm font-bold text-right ${log.type === '입금' ? 'text-blue-600' : 'text-red-500'}`}>
                        {log.type === '입금' ? '+' : '-'} {log.amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-sm text-gray-700">{log.memo || '-'}</td>
                      <td className="p-3 text-sm text-center">
                        <button onClick={() => handleDeleteCashLog(log.id)} className="text-gray-400 hover:text-red-500 transition"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                  {cashLogs.length === 0 && (
                    <tr><td colSpan="5" className="p-8 text-center text-gray-500">시재 내역이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTasksMemoView = () => {
    const handleAddTask = (e) => {
      e?.preventDefault();
      const text = newTaskText.trim();
      if (!text) return;
      const task = {
        id: `T_${Date.now()}`,
        text,
        done: false,
        createdAt: getTodayStr(),
      };
      setTodoTasks((prev) => [task, ...prev]);
      saveItem('todoTasks', task);
      setNewTaskText('');
    };

    const toggleTask = (task) => {
      const willDone = !task.done;
      const updated = {
        ...task,
        done: willDone,
        completedAt: willDone ? getTodayStr() : null,
      };
      setTodoTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      saveItem('todoTasks', updated);
      if (editingTaskId === task.id) {
        setEditingTaskId(null);
        setEditingTaskText('');
      }
    };

    const startEditTask = (task) => {
      setEditingTaskId(task.id);
      setEditingTaskText(task.text);
    };

    const cancelEditTask = () => {
      setEditingTaskId(null);
      setEditingTaskText('');
    };

    const saveEditTask = (task) => {
      const text = editingTaskText.trim();
      if (!text) return showAlert('할 일 내용을 입력해주세요.');
      const updated = { ...task, text };
      setTodoTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      saveItem('todoTasks', updated);
      setEditingTaskId(null);
      setEditingTaskText('');
    };

    const handleDeleteTask = (id) => {
      showConfirm('이 할 일을 삭제하시겠습니까?', () => {
        setTodoTasks((prev) => prev.filter((t) => t.id !== id));
        deleteItem('todoTasks', id);
      });
    };

    const handleAddMemo = () => {
      const memo = {
        id: `SM_${Date.now()}`,
        content: '',
        color: STICKY_NOTE_COLORS[stickyMemos.length % STICKY_NOTE_COLORS.length],
        createdAt: getTodayStr(),
      };
      setStickyMemos((prev) => [memo, ...prev]);
      saveItem('stickyMemos', memo);
    };

    const handleMemoInput = (memo, content) => {
      setStickyMemos((prev) => prev.map((m) => (m.id === memo.id ? { ...m, content } : m)));
    };

    const handleMemoBlur = (memo, content) => {
      const updated = { ...memo, content, updatedAt: getTodayStr() };
      setStickyMemos((prev) => prev.map((m) => (m.id === memo.id ? updated : m)));
      saveItem('stickyMemos', updated);
    };

    const handleDeleteMemo = (id) => {
      showConfirm('이 메모를 삭제하시겠습니까?', () => {
        setStickyMemos((prev) => prev.filter((m) => m.id !== id));
        deleteItem('stickyMemos', id);
      });
    };

    const pendingCount = todoTasks.filter((t) => !t.done).length;
    const pendingTasks = todoTasks.filter((t) => !t.done);
    const completedTasks = todoTasks.filter((t) => t.done);

    const renderTaskItem = (task, isCompletedSection) => (
      <li
        key={task.id}
        className={`group flex items-start gap-3 p-3 rounded-lg border transition-colors ${
          isCompletedSection
            ? 'bg-gray-50 border-gray-100'
            : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-blue-50/30'
        }`}
      >
        <input
          type="checkbox"
          checked={!!task.done}
          onChange={() => toggleTask(task)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
        />
        {editingTaskId === task.id ? (
          <form
            className="flex-1 flex items-center gap-1.5 min-w-0"
            onSubmit={(e) => {
              e.preventDefault();
              saveEditTask(task);
            }}
          >
            <input
              type="text"
              lang="ko"
              style={{ imeMode: 'active' }}
              value={editingTaskText}
              onChange={(e) => setEditingTaskText(e.target.value)}
              className="flex-1 min-w-0 p-1.5 border border-blue-300 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button type="submit" className="px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded shrink-0">
              저장
            </button>
            <button
              type="button"
              onClick={cancelEditTask}
              className="px-2 py-1 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded shrink-0"
            >
              취소
            </button>
          </form>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm leading-snug break-words ${
                  task.done ? 'line-through text-gray-400' : 'text-gray-800 font-medium'
                }`}
              >
                {task.text}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                {task.createdAt || '-'}
                {task.done && task.completedAt ? (
                  <span className="ml-1.5 text-green-600">· 완료 {task.completedAt}</span>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
              <button
                type="button"
                onClick={() => startEditTask(task)}
                className="p-1 text-gray-400 hover:text-blue-600"
                aria-label="수정"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTask(task.id)}
                className="p-1 text-gray-400 hover:text-red-500"
                aria-label="삭제"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </li>
    );

    return (
      <div className="p-6 h-full flex flex-col overflow-hidden">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 shrink-0 flex items-center">
          <ClipboardList className="mr-2 text-blue-600" size={28} />
          할 일 / 메모
        </h2>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
          {/* 할 일 */}
          <div className="flex flex-col min-h-0 flex-1 lg:flex-[1] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 shrink-0 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center">
                <CheckCircle className="mr-2 text-green-600" size={18} />
                할 일
              </h3>
              {pendingCount > 0 && (
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  남은 {pendingCount}건
                </span>
              )}
            </div>
            <form onSubmit={handleAddTask} className="p-3 border-b shrink-0 flex gap-2">
              <input
                type="text"
                lang="ko"
                style={{ imeMode: 'active' }}
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="할 일 입력 후 Enter"
                className="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm shrink-0 flex items-center"
              >
                <Plus size={16} />
              </button>
            </form>
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-[2] min-h-0 flex flex-col overflow-hidden">
                <div className="px-3 py-1.5 border-b bg-white shrink-0">
                  <span className="text-xs font-bold text-gray-500">진행 중</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {pendingTasks.length === 0 ? (
                    <p className="p-4 text-center text-gray-400 text-sm">진행 중인 할 일이 없습니다.</p>
                  ) : (
                    <ul className="space-y-1">{pendingTasks.map((task) => renderTaskItem(task, false))}</ul>
                  )}
                </div>
              </div>
              <div className="flex-[1] min-h-0 flex flex-col overflow-hidden border-t-2 border-gray-200 bg-gray-50/80">
                <div className="px-3 py-1.5 border-b border-gray-200 shrink-0 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">완료</span>
                  {completedTasks.length > 0 && (
                    <span className="text-[10px] font-bold text-gray-400">{completedTasks.length}건</span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-2" onScroll={handleContainerScroll} ref={mainScrollRef}>
                  {completedTasks.length === 0 ? (
                    <p className="p-4 text-center text-gray-400 text-sm">완료한 할 일이 없습니다.</p>
                  ) : (
                    <ul className="space-y-1">{completedTasks.map((task) => renderTaskItem(task, true))}</ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 메모 */}
          <div className="flex flex-col min-h-0 flex-1 lg:flex-[1] rounded-xl shadow-sm border border-gray-100 overflow-hidden bg-[#f5f0e6]">
            <div className="px-4 py-3 border-b border-amber-100/80 bg-amber-50/80 shrink-0 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center">
                <StickyNote className="mr-2 text-amber-600" size={18} />
                메모
              </h3>
              <button
                type="button"
                onClick={handleAddMemo}
                className="px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-bold text-xs flex items-center shadow-sm"
              >
                <Plus size={14} className="mr-1" /> 포스트잇 추가
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {stickyMemos.length === 0 ? (
                <div className="h-full min-h-[12rem] flex flex-col items-center justify-center text-gray-500">
                  <StickyNote size={40} className="mb-3 text-amber-300" />
                  <p className="text-sm mb-3">포스트잇 메모가 없습니다.</p>
                  <button
                    type="button"
                    onClick={handleAddMemo}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-bold text-sm shadow-sm"
                  >
                    첫 메모 추가
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {stickyMemos.map((memo, idx) => (
                    <div
                      key={memo.id}
                      className="relative group shadow-md hover:shadow-lg transition-shadow"
                      style={{
                        backgroundColor: memo.color || STICKY_NOTE_COLORS[idx % STICKY_NOTE_COLORS.length],
                        transform: `rotate(${idx % 2 === 0 ? -1 : 1}deg)`,
                      }}
                    >
                      <textarea
                        lang="ko"
                        style={{ imeMode: 'active' }}
                        value={memo.content || ''}
                        onChange={(e) => handleMemoInput(memo, e.target.value)}
                        onBlur={(e) => handleMemoBlur(memo, e.target.value)}
                        placeholder="메모를 입력하세요..."
                        rows={5}
                        className="sticky-note-scroll w-full min-h-[7.5rem] max-h-40 overflow-y-auto px-4 pt-4 pb-10 bg-transparent border-0 outline-none resize-none text-sm text-gray-800 placeholder:text-gray-500/70 leading-relaxed"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteMemo(memo.id)}
                        className="absolute bottom-2 right-4 p-1.5 rounded-full bg-black/5 text-gray-500 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                        aria-label="메모 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNoticeView = () => {
    const handleNoticeSubmit = (e) => {
      e.preventDefault();
      if (!noticeForm.title) return showAlert('제목을 입력해주세요.');
      
      const newNotice = {
        id: `N_${Date.now()}`,
        date: getTodayStr(),
        title: noticeForm.title,
        content: noticeForm.content
      };

      setNotices([newNotice, ...notices]);
      saveItem('notices', newNotice);
      setNoticeForm({ title: '', content: '' });
      setIsWritingNotice(false);
    };

    const handleDeleteNotice = (id) => {
      showConfirm('해당 공지사항을 삭제하시겠습니까?', () => {
        setNotices(prev => prev.filter(n => n.id !== id));
        deleteItem('notices', id);
      });
    };

    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center"><Bell className="mr-2 text-blue-600"/> 공지사항</h2>
          {!isWritingNotice && (
            <button onClick={() => setIsWritingNotice(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center hover:bg-blue-700 shadow-sm">
              <Plus size={18} className="mr-2"/> 새 공지 작성
            </button>
          )}
        </div>

        {isWritingNotice ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-3xl mb-6">
            <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">공지사항 작성</h3>
            <form onSubmit={handleNoticeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">제목</label>
                <input type="text" lang="ko" style={{ imeMode: 'active' }} value={noticeForm.title} onChange={(e) => setNoticeForm({...noticeForm, title: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="공지 제목" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">내용</label>
                <textarea lang="ko" style={{ imeMode: 'active' }} value={noticeForm.content} onChange={(e) => setNoticeForm({...noticeForm, content: e.target.value})} rows="5" className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="내용을 입력하세요..." />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setIsWritingNotice(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">취소</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">등록</button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col max-w-5xl">
          <div className="flex-1 overflow-y-auto p-2" onScroll={handleContainerScroll} ref={mainScrollRef}>
            {notices.length === 0 ? (
              <div className="p-8 text-center text-gray-500">등록된 공지사항이 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {notices.map(notice => (
                  <div key={notice.id} className="border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm">
                    <div 
                      className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition"
                      onClick={() => setExpandedNoticeId(expandedNoticeId === notice.id ? null : notice.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">{notice.date}</span>
                        <span className={`font-bold ${expandedNoticeId === notice.id ? 'text-blue-600' : 'text-gray-800'}`}>{notice.title}</span>
                      </div>
                      <div className="flex items-center space-x-3 text-gray-400">
                        {expandedNoticeId === notice.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                    {expandedNoticeId === notice.id && (
                      <div className="p-4 bg-gray-50 border-t border-gray-100 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed relative">
                        {notice.content}
                        <button 
                          onClick={() => handleDeleteNotice(notice.id)} 
                          className="absolute bottom-4 right-4 text-xs font-bold text-red-500 bg-white border border-red-200 px-3 py-1.5 rounded hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard': return renderDashboardView();
      case 'sales': return renderSalesView();
      case 'salesReport': return renderSalesReportView();
      case 'productStats': return renderProductStatsView();
      case 'salesStats': return renderSalesStatsView();
      case 'inventory': return renderInventoryView();
      case 'restockHistory': return renderRestockHistoryView();
      case 'customers': return renderCustomerView();
      case 'misong': return renderMisongView();
      case 'cash': return renderCashView(); 
      case 'notice': return renderNoticeView();
      case 'tasksMemo': return renderTasksMemoView();
      case 'settings': return renderSettingsView();
      default: return renderDashboardView();
    }
  };


  const renderProductDetailModal = () => {
    if (!productDetailModalOpen || !selectedProduct) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-[110] p-4" onClick={closeProductDetailModal}>
        <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden ring-1 ring-gray-200/80" onClick={(e) => e.stopPropagation()}>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex justify-center" ref={detailModalScrollRef} onScroll={handleContainerScroll}>
            {renderProductDetailView({ inModal: true })}
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerDetailModal = () => {
    if (!customerDetailModalOpen || !selectedCustomerDetail) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-[110] p-4" onClick={closeCustomerDetailModal}>
        <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden ring-1 ring-gray-200/80" onClick={(e) => e.stopPropagation()}>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex justify-center" ref={detailModalScrollRef} onScroll={handleContainerScroll}>
            {renderCustomerDetailView({ inModal: true })}
          </div>
        </div>
      </div>
    );
  };

  const renderAddProductModal = () => {
    if (!addProductModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-[110] p-4" onClick={closeAddProductModal}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden ring-1 ring-gray-200/80" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700">
            <h2 className="text-lg font-bold text-white">신규 상품 등록</h2>
            <button type="button" onClick={closeAddProductModal} className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white transition"><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50/50" ref={detailModalScrollRef} onScroll={handleContainerScroll}>
            {renderAddProductView({ inModal: true })}
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerMergeModal = () => {
    if (!customerMergeModalOpen) return null;

    const keep = customers.find((c) => c.id === customerMergeKeepId);
    const remove = customers.find((c) => c.id === customerMergeRemoveId);
    const removeName = remove?.name;

    const mergePreview =
      removeName && keep
        ? {
            sales: dailySales.filter((s) => s.customerName === removeName).length,
            misong: misongList.filter((m) => m.customerName === removeName).length,
            sample: sampleList.filter((s) => s.customerName === removeName).length,
            restock: restockHistory.filter((r) => r.supplier === removeName).length,
          }
        : null;

    const handleMergeConfirm = () => {
      if (!customerMergeKeepId || !customerMergeRemoveId) {
        return showAlert('남길 거래처와 합칠(삭제할) 거래처를 모두 선택해주세요.');
      }
      if (customerMergeKeepId === customerMergeRemoveId) {
        return showAlert('서로 다른 거래처 두 곳을 선택해주세요.');
      }
      const k = customers.find((c) => c.id === customerMergeKeepId);
      const r = customers.find((c) => c.id === customerMergeRemoveId);
      if (!k || !r) return showAlert('선택한 거래처를 찾을 수 없습니다.');

      showConfirm(
        `[${r.name}] (${r.id}) 의 모든 거래·미송·샘플·입고 내역을\n[${k.name}] (${k.id}) 로 합치고, 잘못 등록된 거래처는 삭제합니다.\n\n이 작업은 되돌릴 수 없습니다. 진행하시겠습니까?`,
        () => performMergeCustomers(customerMergeKeepId, customerMergeRemoveId)
      );
    };

    return (
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-[110] p-4"
        onClick={() => {
          setCustomerMergeModalOpen(false);
          setCustomerMergeKeepId('');
          setCustomerMergeRemoveId('');
        }}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-visible ring-1 ring-gray-200/80"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between bg-amber-50">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <Merge size={20} className="mr-2 text-amber-600" /> 거래처 합치기
            </h2>
            <button
              type="button"
              onClick={() => {
                setCustomerMergeModalOpen(false);
                setCustomerMergeKeepId('');
                setCustomerMergeRemoveId('');
              }}
              className="rounded-full p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-6 space-y-4 overflow-visible">
            <p className="text-sm text-gray-600 leading-relaxed">
              띄어쓰기 등으로 잘못 나뉜 거래처를 하나로 합칩니다. 판매·반품·미송·샘플·입고·상품 차등단가가
              남기는 업체 이름으로 통합되고, 잘못 등록된 업체는 삭제됩니다.
            </p>
            <CustomerMergeSearchPicker
              label="남길 거래처 (합쳐질 쪽) *"
              selectedId={customerMergeKeepId}
              excludeId={customerMergeRemoveId}
              customers={customers}
              onSelect={setCustomerMergeKeepId}
              focusRingClass="focus:ring-blue-500"
            />
            <CustomerMergeSearchPicker
              label="합칠 거래처 (삭제·통합될 쪽) *"
              selectedId={customerMergeRemoveId}
              excludeId={customerMergeKeepId}
              customers={customers}
              onSelect={setCustomerMergeRemoveId}
              focusRingClass="focus:ring-amber-500"
            />
            {mergePreview && keep && remove && (
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-sm text-gray-700 space-y-1">
                <p className="font-bold text-gray-800">통합 예정 내역 ([{remove.name}])</p>
                <p>판매·반품 {mergePreview.sales}건 · 미송 {mergePreview.misong}건 · 샘플 {mergePreview.sample}건 · 입고(매입처명) {mergePreview.restock}건</p>
                {remove.balance > 0 && (
                  <p>예치금 ₩ {Number(remove.balance).toLocaleString()} → [{keep.name}] 잔고에 합산</p>
                )}
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2 bg-gray-50">
            <button
              type="button"
              onClick={() => {
                setCustomerMergeModalOpen(false);
                setCustomerMergeKeepId('');
                setCustomerMergeRemoveId('');
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white font-medium"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleMergeConfirm}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold shadow-sm"
            >
              합치기 실행
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAddCustomerModal = () => {
    if (!addCustomerModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-[110] p-4" onClick={closeAddCustomerModal}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-gray-200/80" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800">신규 거래처 등록</h2>
            <button type="button" onClick={closeAddCustomerModal} className="rounded-full p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition"><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6" ref={detailModalScrollRef} onScroll={handleContainerScroll}>
            {renderAddCustomerView({ inModal: true })}
          </div>
        </div>
      </div>
    );
  };

  const renderRestockEditModal = () => {
    if (!restockEditForm) return null;
    const suppliers = customers.filter((c) => c.type === '매입처');
    const qtyLabel =
      restockEditForm.type === '매입처반품'
        ? '반품 수량'
        : restockEditForm.type === '초기입고'
          ? '초기 입고 수량'
          : '입고 수량';
    const typeBadgeClass =
      restockEditForm.type === '초기입고'
        ? 'bg-indigo-100 text-indigo-800 ring-indigo-200'
        : restockEditForm.type === '매입처반품'
          ? 'bg-red-100 text-red-800 ring-red-200'
          : 'bg-emerald-100 text-emerald-800 ring-emerald-200';
    const fieldClass =
      'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white outline-none transition focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400';
    const labelClass = 'block text-xs font-bold text-gray-500 mb-1.5';

    return (
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-[110] p-4"
        onClick={closeRestockEditModal}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-gray-200/80"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white">
                <Inbox size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">입고 내역 수정</h2>
                <p className="text-xs text-slate-300 mt-0.5">상품·입고 정보를 함께 수정합니다</p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeRestockEditModal}
              className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-slate-50/60">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${typeBadgeClass}`}>
                {restockEditForm.type}
              </span>
              <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{restockEditForm.productId}</span>
              <span className="text-sm text-gray-600 ml-auto flex items-center gap-1">
                <Calendar size={14} className="text-gray-400" />
                {restockEditForm.date}
                {restockEditForm.time && <span className="text-gray-400">· {restockEditForm.time}</span>}
              </span>
            </div>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 pb-2 border-b border-gray-100">
                <CalendarDays size={16} className="text-blue-600" />
                입고 정보
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>입고 일자</label>
                  <input type="date" name="date" value={restockEditForm.date} onChange={handleRestockEditFormChange} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>입고 시간</label>
                  <input type="time" name="time" value={restockEditForm.time} onChange={handleRestockEditFormChange} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>매입처</label>
                  <select name="supplierId" value={restockEditForm.supplierId} onChange={handleRestockEditFormChange} className={fieldClass}>
                    <option value="">자체제작 / 기타</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{qtyLabel} (장) *</label>
                  <input type="number" name="qty" min="1" value={restockEditForm.qty} onChange={handleRestockEditFormChange} className={`${fieldClass} font-bold tabular-nums`} />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 pb-2 border-b border-gray-100">
                <Package size={16} className="text-blue-600" />
                상품 정보
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>노출용 상품명 *</label>
                  <input type="text" name="name" lang="ko" style={{ imeMode: 'active' }} value={restockEditForm.name} onChange={handleRestockEditFormChange} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>관리용 상품명</label>
                  <input type="text" name="adminName" lang="ko" style={{ imeMode: 'active' }} value={restockEditForm.adminName} onChange={handleRestockEditFormChange} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>분류</label>
                  <select name="category" value={restockEditForm.category} onChange={handleRestockEditFormChange} className={fieldClass}>
                    <option value="상의">상의</option>
                    <option value="하의">하의</option>
                    <option value="세트">세트</option>
                    <option value="아우터">아우터</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>색상</label>
                  <input type="text" name="color" lang="ko" style={{ imeMode: 'active' }} value={restockEditForm.color} onChange={handleRestockEditFormChange} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>사이즈</label>
                  <select name="size" value={restockEditForm.size} onChange={handleRestockEditFormChange} className={fieldClass}>
                    <option value="Free">Free</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>도매단가 (원) *</label>
                  <input type="number" name="price" value={restockEditForm.price} onChange={handleRestockEditFormChange} onWheel={preventMoneyInputWheel} className={`input-money-no-spin ${fieldClass} font-medium tabular-nums`} />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 pb-2 border-b border-gray-100">
                <Tag size={16} className="text-blue-600" />
                상세 정보
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>제조국</label>
                  <input type="text" name="origin" lang="ko" style={{ imeMode: 'active' }} value={restockEditForm.origin} onChange={handleRestockEditFormChange} className={fieldClass} placeholder="예) 대한민국" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>혼용률</label>
                  <input type="text" name="material" lang="ko" style={{ imeMode: 'active' }} value={restockEditForm.material} onChange={handleRestockEditFormChange} className={fieldClass} placeholder="예) 면 80%, 폴리 20%" />
                </div>
              </div>
            </section>

            <div className="flex gap-2 rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-xs text-blue-800">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-blue-600" />
              <p>수량을 변경하면 현재 재고에 차이만큼 자동 반영됩니다. 이미지는 상품 관리에서 수정할 수 있습니다.</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-white shrink-0">
            <button
              type="button"
              onClick={closeRestockEditModal}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-50 transition"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSaveRestockEdit}
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-md shadow-blue-600/25 transition"
            >
              변경사항 저장
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 거래 상세 내역 팝업 렌더링 함수 추가
  const renderSaleDetailModal = () => {
    if (!saleDetailModal) return null;
    
    const { id, date, time, customerName, type, items, total, actualPayment, appliedBalance, deliveryFee: saleDeliveryFee } = saleDetailModal;
    
    return (
      <div
        className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-[110]"
        onClick={() => setSaleDetailModal(null)}
      >
        <div
          className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col relative animate-in fade-in zoom-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4 border-b pb-4 shrink-0">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <FileText className="mr-2 text-blue-600" size={24}/> 
              상세 거래 내역 <span className={`ml-2 text-sm px-2 py-1 rounded text-white ${type === '판매' ? 'bg-blue-500' : 'bg-red-500'}`}>{type}</span>
            </h2>
            <button onClick={() => setSaleDetailModal(null)} className="text-gray-400 hover:text-gray-600 transition p-1 bg-gray-100 hover:bg-gray-200 rounded-full">
              <X size={20} />
            </button>
          </div>
          
          <div className="mb-4 space-y-2 text-sm text-gray-700 bg-gray-50 p-4 rounded-lg shrink-0 border border-gray-100">
            <div className="flex justify-between"><span className="font-bold text-gray-500">거래일시:</span> <span className="font-medium">{date} {time}</span></div>
            <div className="flex justify-between"><span className="font-bold text-gray-500">거래처:</span> <span className="font-bold text-gray-900">{customerName}</span></div>
            <div className="flex justify-between"><span className="font-bold text-gray-500">거래번호:</span> <span className="font-medium text-gray-500">{id}</span></div>
          </div>

          <div className="flex-1 overflow-y-auto mb-4 border border-gray-200 rounded-lg">
            <table className="w-full text-left">
              <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3 text-sm font-bold text-gray-600">상품명</th>
                  <th className="p-3 text-sm font-bold text-gray-600 text-center">옵션</th>
                  <th className="p-3 text-sm font-bold text-gray-600 text-right">단가</th>
                  <th className="p-3 text-sm font-bold text-gray-600 text-right">수량</th>
                  <th className="p-3 text-sm font-bold text-gray-600 text-right">금액</th>
                  <th className="p-3 text-sm font-bold text-gray-600 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items && items.map((item, idx) => {
                  const lineDisplay = resolveLineItemDisplay(products, item);
                  return (
                  <tr key={idx} className="hover:bg-blue-50 transition-colors">
                    <td className="p-3 text-sm font-bold text-gray-800">{lineDisplay.name}</td>
                    <td className="p-3 text-sm text-gray-600 text-center">{lineDisplay.color} / {lineDisplay.size}</td>
                    <td className="p-3 text-sm text-right text-gray-500">₩ {item.price.toLocaleString()}</td>
                    <td className="p-3 text-sm text-right font-medium">{item.qty}장</td>
                    <td className="p-3 text-sm font-bold text-right text-gray-900">₩ {(item.price * item.qty).toLocaleString()}</td>
                    <td className="p-3 text-sm text-center">
                      <button 
                        onClick={() => handlePartialDelete(id, idx)}
                        className="text-red-500 hover:text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded text-xs font-bold transition shadow-sm"
                      >
                        상품 삭제
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-200 pt-4 shrink-0 space-y-2 px-2">
              <div className="flex justify-between text-sm text-gray-600">
                  <span>총 상품 금액:</span>
                  <span className="font-medium">₩ {Math.abs(total || 0).toLocaleString()}</span>
              </div>
              {type === '판매' && (saleDeliveryFee || 0) > 0 && (
                  <div className="flex justify-between text-sm text-amber-700 font-medium">
                      <span className="flex items-center gap-1"><Truck size={14}/> 택배비:</span>
                      <span>+ ₩ {(saleDeliveryFee || 0).toLocaleString()}</span>
                  </div>
              )}
              {type === '판매' && (appliedBalance || 0) > 0 && (
                  <div className="flex justify-between text-sm text-blue-600 font-medium">
                      <span>잔고 차감액:</span>
                      <span>- ₩ {(appliedBalance || 0).toLocaleString()}</span>
                  </div>
              )}
              {type === '반품' && (appliedBalance || 0) > 0 && (
                  <div className="flex justify-between text-sm text-purple-600 font-medium">
                      <span>잔고(예치금) 적립:</span>
                      <span>+ ₩ {(appliedBalance || 0).toLocaleString()}</span>
                  </div>
              )}
              <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 mt-3 pt-3">
                  <span>{type === '판매' ? '최종 결제액' : '최종 반품액'} :</span>
                  <span className={type === '판매' ? 'text-blue-600' : 'text-purple-600'}>
                    ₩ {(actualPayment || 0).toLocaleString()}
                  </span>
              </div>
          </div>

          <div className="mt-6 flex justify-end shrink-0">
            <button 
              onClick={() => setSaleDetailModal(null)}
              className="px-8 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 font-bold shadow-md transition"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex h-screen bg-gray-100 font-sans">
        <div className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
          <div className="border-b border-gray-800">
            <div className="flex items-start p-5 pb-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl mr-3 shadow-sm shrink-0">P</div>
              <div className="min-w-0">
                <h1 className="font-bold text-lg tracking-wide">POS SYSTEM</h1>
                <p className="text-xs text-gray-400">의류 도매 매장관리</p>
              </div>
            </div>
            <p className="px-3 pb-4 text-center text-sm font-extrabold leading-snug text-gray-100 tracking-tight">
              동대문 청평화 2층 가 12호
            </p>
          </div>
          
          <nav className="flex-1 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            {visibleMenuOrder.map((menuId, index) => {
              const { label, Icon } = MENU_CONFIG[menuId];
              return (
                <button 
                  key={menuId} 
                  onClick={() => navigateTo(menuId, true)} 
                  className={`w-full flex justify-between items-center px-6 py-3 text-sm font-medium transition ${activeMenu === menuId ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
                >
                  <div className="flex items-center">
                    <Icon className="mr-3" size={20} /> {label}
                  </div>
                  <span className="text-[10px] text-gray-500 font-bold bg-gray-800 px-1.5 py-0.5 rounded">F{index + 1}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-800">
            <button onClick={() => navigateTo('settings', true)} className="flex items-center text-gray-400 hover:text-white text-sm">
              <Settings className="mr-2" size={16} /> 설정
            </button>
            <button onClick={handleLogout} className="flex items-center text-red-400 hover:text-red-300 text-sm mt-3 w-full text-left">
              <LogOut className="mr-2" size={16} /> 로그아웃
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <main key={activeMenu} className="flex-1 min-h-0 overflow-hidden bg-gray-50 flex flex-col relative z-0">
            {menuHistory.length > 1 && !['dashboard', 'sales', 'salesReport', 'productStats', 'salesStats', 'inventory', 'restockHistory', 'customers', 'misong', 'cash', 'notice', 'tasksMemo'].includes(activeMenu) && (
              <div className="px-6 pt-6 pb-2 shrink-0">
                <button onClick={goBack} className="text-gray-500 hover:text-gray-800 transition flex items-center font-bold text-sm w-max">
                  <ArrowLeft size={16} className="mr-1"/> 뒤로가기
                </button>
              </div>
            )}
            {renderContent()}

            {showTopButton && (
              <button
                onClick={scrollToTop}
                className="absolute bottom-8 right-8 p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition z-50 flex items-center justify-center"
              >
                <ArrowUp size={24} />
              </button>
            )}
          </main>
        </div>
      </div>
      
      {/* 상세 거래 내역 모달 (전역 알림/확인보다 아래 z-index) */}
      {renderProductDetailModal()}
      {renderCustomerDetailModal()}
      {renderCustomerMergeModal()}
      {renderAddProductModal()}
      {renderAddCustomerModal()}
      {renderRestockEditModal()}
      {renderSaleDetailModal()}
      
      {/* 팝업 모달: 다른 오버레이 위에 표시되도록 마지막 렌더 + 높은 z-index */}
      {renderModal()}
    </>
  );
}