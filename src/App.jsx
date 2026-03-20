/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React, { useState, useEffect } from 'react';
import { 
  Home, ShoppingCart, Package, Users, FileText, 
  DollarSign, Clock, Search, Plus, Trash2, 
  CheckCircle, AlertCircle, LogOut, Settings,
  UserPlus, ArrowLeft, TrendingUp, Calendar, BarChart, Tag, Upload,
  ChevronUp, ChevronDown, Inbox
} from 'lucide-react';

// 💡 Firebase 클라우드 연동 모듈
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// 💡 Firebase 설정 (사장님의 실제 데이터베이스)
const firebaseConfig = {
  apiKey: "AIzaSyC4vYq85vGUAV4xRa08KfUW2V2pGgqjSzA",
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

// --- 유틸리티 함수 ---
const getTodayStr = () => {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  return new Date(now.getTime() + kstOffset).toISOString().split('T')[0];
};

const MENU_CONFIG = {
  dashboard: { label: '메인화면 (현황)', Icon: Home },
  sales: { label: '판매 / 반품', Icon: ShoppingCart },
  salesReport: { label: '매출 현황', Icon: TrendingUp },
  inventory: { label: '상품 관리', Icon: Package },
  restockHistory: { label: '입고 내역', Icon: Inbox },
  customers: { label: '업체 내역', Icon: Users },
  addCustomer: { label: '거래처 등록', Icon: UserPlus },
  misong: { label: '미송 / 샘플 내역', Icon: FileText },
};

// --- 공통 컴포넌트 ---
const HeaderClock = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="font-medium tracking-wide">{currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString()}</span>;
};

const LoginView = ({ onLogin, showAlert }) => {
  const [id, setId] = useState(localStorage.getItem('savedPosId') || '');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(!!localStorage.getItem('savedPosId'));

  const handleLogin = (e) => {
    e.preventDefault();
    if (id === 'bsharp' && password === '1234qwer!@') {
      if (rememberId) localStorage.setItem('savedPosId', id);
      else localStorage.removeItem('savedPosId');
      sessionStorage.setItem('pos_logged_in', 'true');
      onLogin();
    } else {
      showAlert('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100 font-sans text-gray-900">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-sm px-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center font-bold text-4xl text-white mb-4 shadow-md">P</div>
          <h1 className="text-2xl font-bold">POS SYSTEM</h1>
          <p className="text-gray-500 text-sm">의류 도매 매장관리 시스템</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">아이디</label>
            <input autoFocus type="text" value={id} onChange={e => setId(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">비밀번호</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" required />
          </div>
          <div className="flex items-center pb-2">
            <input type="checkbox" id="rememberId" checked={rememberId} onChange={e => setRememberId(e.target.checked)} className="w-4 h-4 text-blue-600 rounded cursor-pointer" />
            <label htmlFor="rememberId" className="ml-2 text-sm font-medium cursor-pointer">아이디 기억하기</label>
          </div>
          <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-lg hover:bg-gray-800 transition shadow-md">로그인</button>
        </form>
      </div>
    </div>
  );
};

export default function App() {
  const [menuHistory, setMenuHistory] = useState(['dashboard']);
  const activeMenu = menuHistory[menuHistory.length - 1] || 'dashboard';

  const navigateTo = (menuId, isMainNav = false) => {
    setMenuHistory(prev => isMainNav ? [menuId] : (prev[prev.length - 1] === menuId ? prev : [...prev, menuId]));
  };

  const goBack = () => setMenuHistory(prev => (prev.length <= 1 ? prev : prev.slice(0, -1)));

  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('pos_logged_in') === 'true'); 
  const [menuOrder, setMenuOrder] = useState(Object.keys(MENU_CONFIG));
  const [fbUser, setFbUser] = useState(null);

  // 실사용 데이터 상태
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [misongList, setMisongList] = useState([]);
  const [sampleList, setSampleList] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [restockHistory, setRestockHistory] = useState([]);
  
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [salesCategoryTab, setSalesCategoryTab] = useState('전체');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [transactionDate, setTransactionDate] = useState(getTodayStr());
  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: 'alert', message: '', onConfirm: null });

  // 폼 상태
  const [addProductForm, setAddProductForm] = useState({ name: '', adminName: '', category: '상의', color: '', size: 'Free', price: '', stock: '', material: '', origin: '', image: '', supplierId: '' });
  const [addCustomerForm, setAddCustomerForm] = useState({ type: '판매처', name: '', phone: '', bizNum: '', memo: '' });
  const [productEditForm, setProductEditForm] = useState({});
  const [customerEditForm, setCustomerEditForm] = useState({});
  
  const [selectedProduct, setSelectedProduct] = useState(null); 
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null); 
  const [productDetailEditMode, setProductDetailEditMode] = useState(false);
  const [customerDetailEditMode, setCustomerDetailEditMode] = useState(false);

  const showAlert = (message, onConfirm = null) => setModalConfig({ isOpen: true, type: 'alert', message, onConfirm });
  const showConfirm = (message, onConfirm = null) => setModalConfig({ isOpen: true, type: 'confirm', message, onConfirm });
  const closeModal = () => setModalConfig({ isOpen: false, type: 'alert', message: '', onConfirm: null });

  // Firebase 저장/삭제
  const saveItem = (col, item) => {
    if (!db || !fbUser) return;
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', col, item.id || item.date), item).catch(console.error);
  };
  const deleteItem = (col, id) => {
    if (!db || !fbUser) return;
    deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', col, id)).catch(console.error);
  };

  // 상세 보기 및 핸들러
  const handleGoToProductDetail = (p, editMode = false) => {
    setSelectedProduct(p); setProductEditForm(p); setProductDetailEditMode(editMode); navigateTo('productDetail');
  };
  const handleGoToCustomerDetail = (c, editMode = false) => {
    setSelectedCustomerDetail(c); setCustomerEditForm(c); setCustomerDetailEditMode(editMode); navigateTo('customerDetail');
  };

  // 초기화 및 실시간 데이터 구독
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setFbUser);
  }, []);

  useEffect(() => {
    if (!db || !fbUser) return;
    const sub = (col, setter, sorter) => onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', col), (snap) => {
      const arr = []; snap.forEach(d => arr.push(d.data()));
      if (sorter) arr.sort(sorter);
      setter(arr);
    }, console.error);

    const unsubs = [
      sub('products', setProducts, (a,b) => a.id.localeCompare(b.id)),
      sub('customers', setCustomers, (a,b) => a.id.localeCompare(b.id)),
      sub('misong', setMisongList, (a,b) => b.id.localeCompare(a.id)),
      sub('samples', setSampleList, (a,b) => b.id.localeCompare(a.id)),
      sub('monthlySales', setMonthlySales, (a,b) => b.date.localeCompare(a.date)),
      sub('restockHistory', setRestockHistory, (a,b) => b.date !== a.date ? b.date.localeCompare(a.date) : b.time.localeCompare(a.time)),
      sub('dailySales', setDailySales, (a,b) => b.date !== a.date ? b.date.localeCompare(a.date) : b.time.localeCompare(a.time)),
    ];
    return () => unsubs.forEach(u => u());
  }, [fbUser]);

  // 단축키 설정
  useEffect(() => {
    const handleKD = (e) => {
      if (modalConfig.isOpen) return;
      if (e.key === 'Backspace') {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (!['input', 'textarea', 'select'].includes(tag)) {
          e.preventDefault(); if (['productDetail', 'addProduct', 'customerDetail', 'addCustomer'].includes(activeMenu)) goBack();
        }
      }
      const match = e.key.match(/^F(\d+)$/);
      if (match) {
        const f = parseInt(match[1], 10);
        if (f >= 1 && f <= menuOrder.length) { e.preventDefault(); navigateTo(menuOrder[f - 1], true); }
      }
    };
    window.addEventListener('keydown', handleKD);
    return () => window.removeEventListener('keydown', handleKD);
  }, [modalConfig, menuOrder, activeMenu]);

  // --- 비즈니스 로직 ---
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleAddToCart = (p) => {
    const price = (p.salePrice && p.salePrice < p.price) ? p.salePrice : p.price;
    const ex = cart.find(i => i.id === p.id);
    if (ex) setCart(cart.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
    else setCart([...cart, { ...p, price, qty: 1 }]);
  };

  const handleTransaction = (type) => {
    if (!selectedCustomer) return showAlert("거래처를 선택하세요.");
    if (cart.length === 0) return showAlert("상품을 선택하세요.");
    
    const customerInfo = customers.find(c => c.id === selectedCustomer);
    const dateStr = transactionDate;
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const tid = `TR_${Date.now()}`;
    const amount = cartTotal - discountAmount;

    let updatedProducts = [...products];
    cart.forEach(item => {
      const pIdx = updatedProducts.findIndex(p => p.id === item.id);
      if (pIdx !== -1) {
        updatedProducts[pIdx].stock += (type === '판매' ? -item.qty : item.qty);
        saveItem('products', updatedProducts[pIdx]);
      }
    });

    const newSale = {
      id: tid, date: dateStr, time: timeStr, items: cart,
      customerName: customerInfo?.name || '알수없음',
      total: amount, type, qty: cart.reduce((s,i)=>s+i.qty, 0),
      productName: cart.length > 1 ? `${cart[0].name} 외 ${cart.length-1}건` : cart[0].name
    };
    saveItem('dailySales', newSale);
    
    showAlert(`${type} 처리가 완료되었습니다.`);
    setCart([]); setDiscountAmount(0); setSelectedCustomer('');
  };

  // --- 화면 렌더링 함수들 ---
  const renderDashboard = () => {
    const ts = dailySales.filter(s => s.date === getTodayStr());
    const rev = ts.reduce((s,v) => s + (v.type === '판매' ? v.total : -v.total), 0);
    return (
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">금일 영업 현황</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><DollarSign size={24} /></div>
            <div><p className="text-sm text-gray-500 font-medium">오늘 순매출</p><p className="text-2xl font-bold">₩ {rev.toLocaleString()}</p></div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-lg"><CheckCircle size={24} /></div>
            <div><p className="text-sm text-gray-500 font-medium">거래 건수</p><p className="text-2xl font-bold">{ts.length} 건</p></div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-lg"><Package size={24} /></div>
            <div><p className="text-sm text-gray-500 font-medium">재고 부족 상품</p><p className="text-2xl font-bold text-red-500">{products.filter(p=>p.stock < 10).length} 품목</p></div>
          </div>
        </div>
      </div>
    );
  };

  const renderSales = () => (
    <div className="h-full flex flex-col md:flex-row bg-gray-50">
      <div className="w-full md:w-80 bg-white border-r flex flex-col shrink-0 shadow-lg">
        <div className="p-4 border-b space-y-3">
          <select className="w-full p-2 border rounded" value={selectedCustomer} onChange={e=>setSelectedCustomer(e.target.value)}>
            <option value="">-- 거래처 선택 --</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" className="w-full p-2 border rounded" value={transactionDate} onChange={e=>setTransactionDate(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.map(i => (
            <div key={i.id} className="p-3 border rounded-lg relative bg-white shadow-sm">
              <button onClick={()=>setCart(cart.filter(c=>c.id!==i.id))} className="absolute top-2 right-2 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
              <p className="font-bold text-sm">{i.name}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">{i.qty}개 x {i.price.toLocaleString()}</span>
                <span className="font-bold text-blue-600 text-sm">₩ {(i.qty*i.price).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 bg-gray-900 text-white space-y-3">
          <div className="flex justify-between text-sm text-gray-400"><span>합계</span><span>₩ {cartTotal.toLocaleString()}</span></div>
          <div className="flex justify-between font-bold text-lg"><span>결제액</span><span className="text-green-400">₩ {(cartTotal-discountAmount).toLocaleString()}</span></div>
          <button onClick={()=>handleTransaction('판매')} className="w-full bg-blue-600 py-3 rounded-lg font-bold hover:bg-blue-500">결제 완료</button>
        </div>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex justify-between mb-6">
          <h2 className="text-xl font-bold">상품 선택</h2>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2 text-gray-400" size={18}/>
            <input type="text" placeholder="상품명 검색..." className="w-full pl-8 pr-4 py-2 border rounded-full outline-none focus:ring-2 focus:ring-blue-500" value={salesSearchQuery} onChange={e=>setSalesSearchQuery(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {products.filter(p=>p.name.includes(salesSearchQuery)).map(p => (
            <div key={p.id} onClick={()=>handleAddToCart(p)} className="bg-white p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-blue-500 shadow-sm transition">
              <div className="aspect-[3/4] bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-gray-300">
                {p.image ? <img src={p.image} className="w-full h-full object-cover rounded-lg" alt=""/> : <Package size={32}/>}
              </div>
              <p className="font-bold text-sm truncate">{p.name}</p>
              <p className="text-xs text-gray-500">{p.color} / {p.size}</p>
              <div className="flex justify-between mt-2">
                <span className="text-blue-600 font-bold">₩ {p.price.toLocaleString()}</span>
                <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">재고: {p.stock}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">상품 관리</h2>
        <button onClick={()=>navigateTo('addProduct')} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center font-bold hover:bg-blue-700">
          <Plus size={18} className="mr-2"/> 신규 등록
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b text-sm font-bold text-gray-500">
            <tr><th className="p-4">코드</th><th className="p-4">상품명</th><th className="p-4">단가</th><th className="p-4">재고</th><th className="p-4 text-center">관리</th></tr>
          </thead>
          <tbody className="divide-y text-sm">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium">{p.id}</td>
                <td className="p-4 font-bold text-blue-600 cursor-pointer" onClick={()=>handleGoToProductDetail(p)}>{p.name} ({p.color})</td>
                <td className="p-4">₩ {p.price.toLocaleString()}</td>
                <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${p.stock < 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{p.stock} 장</span></td>
                <td className="p-4 text-center space-x-2">
                  <button onClick={()=>handleGoToProductDetail(p, true)} className="bg-blue-50 text-blue-600 px-3 py-1 rounded font-bold">수정</button>
                  <button onClick={()=>deleteItem('products', p.id)} className="bg-red-50 text-red-600 px-3 py-1 rounded font-bold">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCustomers = () => (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">업체 내역</h2>
        <button onClick={()=>navigateTo('addCustomer')} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center font-bold">신규 업체</button>
      </div>
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b">
            <tr><th className="p-4">업체명</th><th className="p-4">연락처</th><th className="p-4">잔고</th><th className="p-4">관리</th></tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="p-4 font-bold cursor-pointer hover:text-blue-600" onClick={()=>handleGoToCustomerDetail(c)}>{c.name}</td>
                <td className="p-4">{c.phone}</td>
                <td className="p-4 font-bold text-blue-600">₩ {(c.balance || 0).toLocaleString()}</td>
                <td className="p-4 space-x-2">
                  <button onClick={()=>handleGoToCustomerDetail(c, true)} className="text-blue-600">수정</button>
                  <button onClick={()=>deleteItem('customers', c.id)} className="text-red-500">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard': return renderDashboard();
      case 'sales': return renderSales();
      case 'inventory': return renderInventory();
      case 'customers': return renderCustomers();
      case 'salesReport': return <div className="p-10 text-center font-bold text-gray-500"><TrendingUp size={48} className="mx-auto mb-4 opacity-20"/>매출 현황 분석...<div className="flex justify-center gap-2 mt-4"><Calendar/><BarChart/></div></div>;
      case 'restockHistory': return <div className="p-10 text-center font-bold text-gray-500"><Inbox size={48} className="mx-auto mb-4 opacity-20"/>입고 내역 관리...</div>;
      case 'misong': return <div className="p-10 text-center font-bold text-gray-500"><FileText size={48} className="mx-auto mb-4 opacity-20"/>미송/샘플 관리...</div>;
      case 'addProduct': return <div className="p-10 text-center font-bold text-gray-500"><Plus size={48} className="mx-auto mb-4 opacity-20"/>상품 등록...</div>;
      case 'addCustomer': return <div className="p-10 text-center font-bold text-gray-500"><UserPlus size={48} className="mx-auto mb-4 opacity-20"/>거래처 등록...</div>;
      case 'settings': return <div className="p-10 text-center text-gray-500 font-bold"><Settings size={48} className="mx-auto mb-4 opacity-20"/>설정 메뉴...<div className="flex justify-center gap-2 mt-4"><ChevronUp/><ChevronDown/></div></div>;
      default: return renderDashboard();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden text-gray-900">
      <div className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="p-5 flex items-center border-b border-gray-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl mr-3 shadow-sm">P</div>
          <h1 className="font-bold text-lg tracking-wide">POS SYSTEM</h1>
        </div>
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {menuOrder.map((id, idx) => (
            <button key={id} onClick={() => navigateTo(id, true)} className={`w-full flex justify-between items-center px-6 py-3 text-sm font-medium transition ${activeMenu === id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <div className="flex items-center">
                {MENU_CONFIG[id] && React.createElement(MENU_CONFIG[id].Icon, { className: "mr-3", size: 20 })}
                {MENU_CONFIG[id]?.label}
              </div>
              <span className="text-[10px] text-gray-600 font-bold bg-black/20 px-1.5 py-0.5 rounded">F{idx + 1}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button onClick={() => navigateTo('settings', true)} className="flex items-center text-gray-500 hover:text-white text-sm w-full mb-3"><Settings className="mr-2" size={16} /> 설정</button>
          <button onClick={() => showConfirm('로그아웃 하시겠습니까?', ()=>setIsAuthenticated(false))} className="flex items-center text-red-400 hover:text-red-300 text-sm w-full"><LogOut className="mr-2" size={16} /> 로그아웃</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center font-bold text-gray-700">동대문 청평화 2층 가 12호</div>
          <div className="flex items-center space-x-6 text-gray-500">
            <div className="flex items-center text-sm"><Clock className="mr-2" size={18} /><HeaderClock /></div>
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">관리</div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto relative">
          {menuHistory.length > 1 && !['dashboard','sales','inventory','customers'].includes(activeMenu) && (
            <button onClick={goBack} className="absolute top-4 left-6 flex items-center text-gray-500 hover:text-gray-900 font-bold text-sm z-10"><ArrowLeft size={16} className="mr-1"/> 뒤로가기</button>
          )}
          {renderContent()}
        </main>
      </div>

      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-3 flex items-center">
              {modalConfig.type === 'confirm' ? <AlertCircle className="mr-2 text-blue-500" size={20}/> : <CheckCircle className="mr-2 text-green-500" size={20}/>}
              {modalConfig.type === 'confirm' ? '확인' : '알림'}
            </h3>
            <p className="text-gray-600 mb-6 text-sm leading-relaxed whitespace-pre-wrap">{modalConfig.message}</p>
            <div className="flex justify-end space-x-2">
              {modalConfig.type === 'confirm' && <button onClick={closeModal} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold">취소</button>}
              <button onClick={() => { if (modalConfig.onConfirm) modalConfig.onConfirm(); closeModal(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-200">확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}