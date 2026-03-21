import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, ShoppingCart, Package, Users, FileText, 
  DollarSign, Clock, Search, Plus, Minus, Trash2, 
  CheckCircle, AlertCircle, ChevronRight, LogOut, Settings,
  UserPlus, ArrowLeft, TrendingUp, Calendar, BarChart, Tag, Upload,
  ChevronUp, ChevronDown, Inbox, Printer
} from 'lucide-react';

// 💡 Firebase 클라우드 연동 모듈 임포트
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// 💡 Firebase 초기화 셋업 (사장님의 실제 데이터베이스 연결)
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

const HeaderClock = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="font-medium tracking-wide">
      {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString()}
    </span>
  );
};

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
            <input autoFocus type="text" value={id} onChange={e => setId(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" required />
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

  const navigateTo = (menuId, isMainNav = false) => {
    setMenuHistory(prev => {
      if (isMainNav) return [menuId];
      if (prev[prev.length - 1] === menuId) return prev;
      return [...prev, menuId];
    });
  };

  const goBack = () => {
    setMenuHistory(prev => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  };

  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('pos_logged_in') === 'true'); 
  const [menuOrder, setMenuOrder] = useState(Object.keys(MENU_CONFIG));

  const [fbUser, setFbUser] = useState(null);

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [misongList, setMisongList] = useState([]);
  const [sampleList, setSampleList] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [restockHistory, setRestockHistory] = useState([]);
  
  const [selectedProduct, setSelectedProduct] = useState(null); 
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null); 
  
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [salesCategoryTab, setSalesCategoryTab] = useState('전체');
  
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [addProductForm, setAddProductForm] = useState({ name: '', adminName: '', category: '상의', color: '', size: 'Free', price: '', stock: '', material: '', origin: '', image: '', supplierId: '' });
  
  const [productDetailEditMode, setProductDetailEditMode] = useState(false);
  const [productEditForm, setProductEditForm] = useState({});
  const [productRestockQty, setProductRestockQty] = useState('');
  const [productRestockSupplierId, setProductRestockSupplierId] = useState('');

  const [restockSearchDate, setRestockSearchDate] = useState(getTodayStr());
  const [restockSearchQuery, setRestockSearchQuery] = useState('');

  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerListTab, setCustomerListTab] = useState('전체');
  
  const [customerDetailEditMode, setCustomerDetailEditMode] = useState(false);
  const [customerEditForm, setCustomerEditForm] = useState({});
  const [addCustomerForm, setAddCustomerForm] = useState({ type: '판매처', name: '', phone: '', bizNum: '', memo: '' });

  const today = getTodayStr();
  const [reportDate, setReportDate] = useState(today);
  const [reportMonth, setReportMonth] = useState(today.substring(0, 7));
  const [salesReportTab, setSalesReportTab] = useState('daily');
  const [salesReportSort, setSalesReportSort] = useState({ key: 'date', direction: 'desc' });

  const [misongTab, setMisongTab] = useState('misong');
  const [transactionDate, setTransactionDate] = useState(today);

  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: 'alert', message: '', onConfirm: null });

  const showAlert = (message, onConfirm = null) => setModalConfig({ isOpen: true, type: 'alert', message, onConfirm });
  const showConfirm = (message, onConfirm = null) => setModalConfig({ isOpen: true, type: 'confirm', message, onConfirm });
  const closeModal = () => setModalConfig({ isOpen: false, type: 'alert', message: '', onConfirm: null });

  const saveItem = (colName, item) => {
    if (!db || !fbUser) return;
    const id = item.id || item.date;
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', colName, id), item).catch(console.error);
  };

  const deleteItem = (colName, id) => {
    if (!db || !fbUser) return;
    deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', colName, id)).catch(console.error);
  };

  const handleGoToProductDetail = (p, editMode = false) => {
    setSelectedProduct(p);
    setProductEditForm(p);
    setProductDetailEditMode(editMode);
    setProductRestockQty('');
    setProductRestockSupplierId('');
    navigateTo('productDetail');
  };

  const handleGoToCustomerDetail = (c, editMode = false) => {
    setSelectedCustomerDetail(c);
    setCustomerEditForm(c);
    setCustomerDetailEditMode(editMode);
    navigateTo('customerDetail');
  };

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (tokenError) {
            if (tokenError.code === 'auth/custom-token-mismatch') {
              console.warn("미리보기 환경 토큰과 개인 설정 불일치: 익명 로그인으로 안전하게 전환합니다.");
              await signInAnonymously(auth);
            } else {
              console.error('Auth token error:', tokenError);
            }
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error('Auth error:', e);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setFbUser(u);
    });
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
      setupSubscription('products', setProducts, (a,b) => a.id.localeCompare(b.id)),
      setupSubscription('customers', setCustomers, (a,b) => a.id.localeCompare(b.id)),
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

      if (e.key === 'Backspace') {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea' && activeTag !== 'select') {
          e.preventDefault();
          if (['productDetail', 'addProduct', 'customerDetail', 'addCustomer'].includes(activeMenu)) {
            goBack();
          }
        }
        return;
      }

      const match = e.key.match(/^F(\d+)$/);
      if (match) {
        const fNumber = parseInt(match[1], 10);
        if (fNumber >= 1 && fNumber <= menuOrder.length) {
          e.preventDefault(); 
          navigateTo(menuOrder[fNumber - 1], true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalConfig, menuOrder, activeMenu, menuHistory]);

  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // =========================================================================
  // 💡 [최종 완결판] 영수증 2장 자동 출력 로직 + QR코드/상호명 좌우정렬 레이아웃 적용
  // =========================================================================
  const printReceipt = (receiptData) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const now = new Date();
    const printTime = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

    // 구매 물품 리스트 HTML 생성
    let itemsHtml = '';
    receiptData.cart.forEach(item => {
      const itemTotal = item.qty * item.price;
      itemsHtml += `
        <div class="item">
          <div class="item-name">${item.name} (${item.color}/${item.size})</div>
          <div class="item-calc">
            <span>${item.price.toLocaleString()} x ${item.qty}</span>
            <span>${itemTotal.toLocaleString()}</span>
          </div>
          ${item.misongQty > 0 ? `<div class="misong-notice">* 미송포함: ${item.misongQty}장</div>` : ''}
        </div>
      `;
    });

    // 결제 요약 영역 HTML 생성
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
        ${receiptData.appliedBalance > 0 ? `
        <div class="summary-line text-discount">
          <span>잔고 차감</span>
          <span>-${receiptData.appliedBalance.toLocaleString()}</span>
        </div>` : ''}
        <div class="divider"></div>
        <div class="summary-line total-line">
          <span>최종 결제액</span>
          <span>${receiptData.actualPayment.toLocaleString()}</span>
        </div>
      `;
    } else if (receiptData.type === '반품') {
      summaryHtml = `
        <div class="summary-line total-line">
          <span>총 반품액 (잔고적립)</span>
          <span>${receiptData.amountAfterDiscount.toLocaleString()}</span>
        </div>
      `;
    } else if (receiptData.type === '샘플') {
      summaryHtml = `
        <div class="summary-line total-line">
          <span>샘플 출고</span>
          <span>총 ${receiptData.cart.reduce((s, i) => s + i.qty, 0)} 장</span>
        </div>
      `;
    }

    // 하나의 영수증(1장)을 그리는 헬퍼 함수
    const generateReceiptBody = (receiptTypeLabel) => `
      <div class="receipt">
        <div class="header">
          <!-- 중앙 상단 로고 -->
          <img src="B# 로고.png" alt="B# 로고" class="logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div class="logo-text-fallback" style="display:none;">B#</div>
          
          <!-- 매장정보 좌측, QR코드 우측 배치 -->
          <div class="info-row">
            <div class="info-left">
              <div class="store-address">청평화 2층 가 12호</div>
              <div class="store-contact">
                Tel : 010-7208-8833<br>
                Kakao : bsharp8833<br>
                E-mail : bsharp@kakao.com
              </div>
            </div>
            <div class="info-right">
              <div class="qr-title">카톡 문의</div>
              <img src="카톡.png" alt="카카오톡 QR" class="qr-code" onerror="this.style.display='none'; this.parentElement.innerText='(QR 없음)';">
            </div>
          </div>

          <div class="receipt-title">
            영 수 증 (${receiptData.type})<br>
            <span class="receipt-type">[${receiptTypeLabel}]</span>
          </div>
          <div class="print-time">${printTime}</div>
        </div>
        
        <div class="divider-solid"></div>
        <div class="customer-info">거래처 : ${receiptData.customerName}</div>
        <div class="divider-solid"></div>
        
        ${itemsHtml}
        
        <div class="divider"></div>
        
        ${summaryHtml}
        
        <!-- 계좌번호 박스 -->
        <div class="account-box">
          <div class="bank-title">입금계좌 안내</div>
          <div class="bank-num">신한 333 12 268693</div>
          <div class="bank-owner">예금주: 강희창</div>
        </div>
        
        <div class="footer">
          <p>이용해 주셔서 감사합니다.</p>
          ${receiptData.type === '결제' ? '<p>(교환/반품 시 영수증 지참 요망)</p>' : ''}
        </div>
      </div>
    `;

    // 전체 HTML (고객용 1장 + 매장 보관용 1장 + CSS 스타일)
    const htmlContent = `
      <html>
      <head>
        <title>영수증</title>
        <style>
          /* POS 감열식 프린터(80mm) 최적화 스타일 */
          body { 
            font-family: 'Malgun Gothic', 'Dotum', sans-serif; 
            font-size: 12px; 
            color: #000;
            margin: 0; 
            padding: 10px; 
            width: 280px; 
          }
          
          /* 프린터가 2장으로 인식하고 중간에 자르도록 하는 속성 */
          .page-break { page-break-after: always; margin-bottom: 20px; }
          
          .header { text-align: center; margin-bottom: 10px; }
          
          .logo { max-width: 100px; max-height: 60px; margin: 0 auto 10px; display: block; object-fit: contain; }
          .logo-text-fallback { font-size: 32px; font-weight: 900; margin-bottom: 10px; font-style: italic; }
          
          /* 좌/우 분할 레이아웃 */
          .info-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
          .info-left { text-align: left; }
          .store-address { font-size: 13px; margin-bottom: 4px; font-weight: bold; }
          .store-contact { font-size: 11px; line-height: 1.5; }
          
          .info-right { text-align: center; border: 1px solid #eee; padding: 3px; border-radius: 4px; }
          .info-right .qr-title { font-size: 10px; font-weight: bold; margin-bottom: 2px; }
          .info-right .qr-code { width: 55px; height: 55px; display: block; object-fit: contain; }
          
          .receipt-title { font-size: 18px; font-weight: bold; margin: 10px 0 5px; letter-spacing: 2px; line-height: 1.3; }
          .receipt-type { font-size: 14px; color: #555; }
          .print-time { font-size: 10px; color: #555; margin-top: 5px; }
          
          .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
          .divider-solid { border-bottom: 1px solid #000; margin: 10px 0; }
          
          .customer-info { font-weight: bold; font-size: 14px; margin: 10px 0; }
          .item { margin-bottom: 10px; }
          .item-name { font-weight: bold; font-size: 12px; margin-bottom: 2px; }
          .item-calc { display: flex; justify-content: space-between; font-size: 12px; padding-left: 10px;}
          .misong-notice { font-size: 11px; padding-left: 10px; margin-top: 2px; font-weight: bold; }
          
          .summary-line { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
          .text-discount { color: #333; }
          .total-line { font-size: 17px; font-weight: bold; margin-top: 5px; }
          
          .account-box { border: 1.5px solid #000; padding: 10px; margin: 15px 0 10px; text-align: center; }
          .account-box .bank-title { font-size: 11px; margin-bottom: 4px; }
          .account-box .bank-num { font-size: 14px; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px; }
          .account-box .bank-owner { font-size: 13px; font-weight: bold; }
          
          .footer { text-align: center; margin-top: 15px; font-size: 11px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <!-- 💡 1. 고객용 영수증 출력 (출력 후 프린터 컷팅 발생) -->
        <div class="page-break">
          ${generateReceiptBody('고객용')}
        </div>
        
        <!-- 💡 2. 매장 보관용 영수증 출력 -->
        <div>
          ${generateReceiptBody('매장 보관용')}
        </div>
      </body>
      </html>
    `;

    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(htmlContent);
    iframe.contentWindow.document.close();

    // 렌더링 대기 후 인쇄 호출
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      // 인쇄 완료 후 iframe 제거
      setTimeout(() => { document.body.removeChild(iframe); }, 1000);
    }, 500);
  };
  // =========================================================================

  const handleDeleteProduct = (id) => {
    showConfirm('해당 상품을 정말 삭제하시겠습니까?\n(삭제 시 관련된 다른 내역에 영향을 줄 수 있습니다)', () => {
      setProducts(products.filter(p => p.id !== id));
      deleteItem('products', id); 
      if (activeMenu === 'productDetail' && selectedProduct?.id === id) {
        navigateTo('inventory', true);
      }
    });
  };

  const handleDeleteCustomer = (id) => {
    showConfirm('해당 거래처를 정말 삭제하시겠습니까?\n(삭제 시 기존 거래 내역과 연결이 끊어질 수 있습니다)', () => {
      setCustomers(customers.filter(c => c.id !== id));
      deleteItem('customers', id); 
      if (activeMenu === 'customerDetail' && selectedCustomerDetail?.id === id) {
        navigateTo('customers', true);
      }
    });
  };

  const handleCancelSale = (saleId) => {
    showConfirm("정말 삭제하시겠습니까?\n(관련된 재고, 월별 매출, 고객 잔고가 자동 복구되며, 포함된 미송 내역도 함께 삭제됩니다.)", () => {
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
      } else if (sale.productId) { 
        const pIdx = updatedProducts.findIndex(p => p.id === sale.productId);
        if (pIdx !== -1) {
          const stockDelta = sale.type === '판매' ? sale.qty : -sale.qty;
          updatedProducts[pIdx].stock = Math.max(0, updatedProducts[pIdx].stock + stockDelta);
          saveItem('products', updatedProducts[pIdx]); 
        }
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

      showAlert("거래 내역이 성공적으로 삭제(취소)되었습니다.\n(고객 잔고 및 재고에 해당 내용이 복구 반영되었습니다.)");
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
        {modalConfig.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 transform transition-all">
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
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition text-sm"
                  >
                    취소
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (modalConfig.onConfirm) modalConfig.onConfirm();
                    closeModal();
                  }} 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition text-sm"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const renderSettingsView = () => {
    const moveUp = (index) => {
      if (index === 0) return;
      const newOrder = [...menuOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setMenuOrder(newOrder);
    };

    const moveDown = (index) => {
      if (index === menuOrder.length - 1) return;
      const newOrder = [...menuOrder];
      [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
      setMenuOrder(newOrder);
    };

    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">환경 설정</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><Printer className="mr-2" size={20}/> 영수증 프린터 설정 안내</h3>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed bg-blue-50 p-4 rounded-lg">
            결제, 반품, 샘플 버튼 클릭 시 화면 우측에서 자동으로 <strong>2장의 영수증(고객용/매장용)</strong>이 인쇄 창으로 나타납니다.<br/>
            크롬(Chrome) 브라우저 기준으로 아래와 같이 한 번만 설정해 두시면 편리합니다.
            <br/><br/>
            1. 인쇄 대상: <b>사용하시는 POS 영수증 프린터</b> 선택<br/>
            2. 용지 크기: <b>80mm x 297mm</b> (또는 Roll Paper) 선택<br/>
            3. 여백: <b>최소</b> 또는 <b>없음</b><br/>
            4. 배율: <b>기본설정</b> 또는 너비에 맞게 조절
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          <h3 className="text-lg font-bold text-gray-800 mb-4">메인 메뉴 순서 변경</h3>
          <p className="text-sm text-gray-500 mb-4">위/아래 버튼을 눌러 왼쪽 메뉴의 우선순위를 변경할 수 있습니다.<br/>순서에 따라 키보드 최상단 <b className="text-blue-600">F1 ~ F7</b> 단축키가 자동 할당됩니다.</p>
          <div className="space-y-2 mt-6">
            {menuOrder.map((menuId, index) => {
              const { label, Icon } = MENU_CONFIG[menuId];
              return (
                <div key={menuId} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition">
                  <div className="flex items-center">
                    <span className="w-10 font-black text-blue-600 text-lg">F{index + 1}</span>
                    <Icon className="mr-3 text-gray-600" size={20} />
                    <span className="font-bold text-gray-800">{label}</span>
                  </div>
                  <div className="flex space-x-1">
                    <button onClick={() => moveUp(index)} disabled={index === 0} className="p-2 bg-white border rounded shadow-sm hover:bg-gray-50 disabled:opacity-30 transition"><ChevronUp size={16} className="text-gray-700"/></button>
                    <button onClick={() => moveDown(index)} disabled={index === menuOrder.length - 1} className="p-2 bg-white border rounded shadow-sm hover:bg-gray-50 disabled:opacity-30 transition"><ChevronDown size={16} className="text-gray-700"/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderDashboardView = () => {
    const displayDate = getTodayStr(); 
    const todaySalesList = dailySales.filter(sale => sale.date === displayDate);
    
    const todayNetSales = todaySalesList.reduce((sum, sale) => {
      if (sale.type === '판매') {
        return sum + (sale.actualPayment ?? sale.total) + (sale.appliedBalance || 0);
      } else {
        const returnAmt = sale.appliedBalance > 0 ? sale.appliedBalance : Math.abs(sale.actualPayment ?? sale.total);
        return sum - returnAmt;
      }
    }, 0);
    const todaySalesCount = todaySalesList.length;
    const totalBalance = customers.reduce((sum, c) => sum + c.balance, 0);
    const pendingMisongCount = misongList.filter(m => m.shippedQty < m.qty).length;
    const recentSales = dailySales.slice(0, 5);

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">금일 영업 현황 (메인화면)</h2>
          <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">오늘: {displayDate}</span>
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
                  <th className="p-3">시간</th><th className="p-3">거래처</th><th className="p-3">품목수</th><th className="p-3">실결제액</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map(sale => (
                  <tr key={sale.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm">{sale.time}</td>
                    <td className="p-3 text-sm font-medium">{sale.customerName}</td>
                    <td className="p-3 text-sm">{sale.qty}장</td>
                    <td className={`p-3 text-sm font-bold ${sale.type === '반품' ? 'text-gray-500' : 'text-gray-800'}`}>
                      {sale.type === '반품' && sale.actualPayment === 0 ? <span className="text-[10px] text-purple-500 font-normal mr-1">예치금</span> : null}
                      ₩ {Math.abs(sale.actualPayment ?? sale.total).toLocaleString()} {sale.type === '반품' && sale.actualPayment !== 0 && '(반품)'}
                    </td>
                  </tr>
                ))}
                {recentSales.length === 0 && (<tr><td colSpan="4" className="p-4 text-center text-gray-500 text-sm">최근 판매 내역이 없습니다.</td></tr>)}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><AlertCircle className="mr-2" size={20}/> 재고 부족 알림</h3>
            <ul className="space-y-3">
              {products.filter(p => p.stock < 10).map(p => (
                <li key={p.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-bold text-gray-800">{p.name}</p>
                    <p className="text-sm text-gray-500">{p.color} / {p.size}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold mr-2">{p.stock === 0 ? '품절' : '임박'}</span>
                    <span className="font-bold text-gray-800">{p.stock} 장</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const handleAddToCart = (product) => {
    const activePrice = (product.salePrice && product.salePrice < product.price) ? product.salePrice : product.price;
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, price: activePrice, originalPrice: product.price, qty: 1 }]);
    }
  };

  const updateCartQty = (id, delta) => setCart(cart.map(item => item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
  const removeCartItem = (id) => setCart(cart.filter(item => item.id !== id));

  const handleTransaction = (type) => {
    if (!selectedCustomer) { showAlert("거래처를 선택해주세요."); return; }
    if (cart.length === 0) { showAlert("상품을 추가해주세요."); return; }

    const customerInfo = customers.find(c => c.id === selectedCustomer);
    const customerName = customerInfo?.name || '알수없음';
    
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    
    const dateStr = transactionDate;
    const transactionId = `TR_${Date.now()}`;

    const amountAfterDiscount = cartTotal - discountAmount;

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
    let autoMisongCount = 0;
    
    let cartWithDetails = cart.map(item => ({...item}));

    cartWithDetails.forEach((item, index) => {
      const productIndex = updatedProducts.findIndex(p => p.id === item.id);
      let currentStock = updatedProducts[productIndex]?.stock || 0;
      let misongQty = 0;

      if (type === '결제') {
        if (item.qty > currentStock) {
          misongQty = item.qty - currentStock;
          autoMisongCount++;
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

    let alertMsg = '';
    if (type === '결제') {
      alertMsg = `[결제 완료]\n총 상품금액: ₩${cartTotal.toLocaleString()}`;
      if (discountAmount > 0) alertMsg += `\n할인적용: -₩${discountAmount.toLocaleString()}`;
      if (appliedBalance > 0) alertMsg += `\n고객잔고 차감: -₩${appliedBalance.toLocaleString()}`;
      alertMsg += `\n-----------------------\n최종 결제액: ₩${actualPayment.toLocaleString()}`;
      if (autoMisongCount > 0) alertMsg += `\n\n※ 재고가 부족한 상품은 자동으로 미송 처리되었습니다.`;
    } else if (type === '반품') {
      alertMsg = `[반품 처리 완료]\n반품액 ₩${amountAfterDiscount.toLocaleString()} 이(가) 고객 잔고(예치금)로 적립되었습니다.`;
    } else if (type === '샘플') {
      alertMsg = `[샘플 출고 완료]\n샘플 내역에 추가되었으며, 재고가 차감되었습니다.`;
    }

    showAlert(alertMsg);

    // 💡 [실행] 영수증 2장 자동 출력 함수 호출 (QR코드 등 반영완료)
    const receiptData = {
      type,
      customerName,
      cart: cartWithDetails,
      cartTotal,
      discountAmount,
      appliedBalance,
      actualPayment,
      amountAfterDiscount
    };
    printReceipt(receiptData);

    setCart([]);
    setDiscountAmount(0);
    setSelectedCustomer('');
    setSalesSearchQuery('');
  };

  const renderSalesView = () => {
    const CATEGORIES = ['전체', '상의', '하의', '세트', '아우터'];

    const filteredProductsForSales = products.filter(p => {
      const matchCategory = salesCategoryTab === '전체' || p.category === salesCategoryTab || (!p.category && salesCategoryTab === '상의');
      const matchSearch = p.name.toLowerCase().includes(salesSearchQuery.toLowerCase()) || 
        (p.adminName && p.adminName.toLowerCase().includes(salesSearchQuery.toLowerCase())) ||
        (p.color && p.color.toLowerCase().includes(salesSearchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });

    const amountAfterDiscountPreview = cartTotal - discountAmount;
    const customerInfo = customers.find(c => c.id === selectedCustomer);
    const availableBalance = customerInfo ? Math.max(0, customerInfo.balance) : 0;
    const usedBalancePreview = Math.max(0, Math.min(availableBalance, amountAfterDiscountPreview));
    const finalPaymentPreview = Math.max(0, amountAfterDiscountPreview - usedBalancePreview);

    return (
      <div className="h-full flex flex-col md:flex-row bg-gray-100">
        <div className="w-full md:w-1/3 bg-white border-r border-gray-200 flex flex-col shadow-lg z-10">
          <div className="p-4 bg-gray-50 border-b space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-800">판매 일자</h2>
              <div className="flex items-center space-x-2">
                <input 
                  type="date" 
                  value={transactionDate} 
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="p-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
                />
                <button onClick={() => setTransactionDate(today)} className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded text-xs font-bold hover:bg-blue-100 transition">오늘</button>
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800 mb-2">거래처 선택</h2>
              <select 
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
              >
                <option value="">-- 거래처 선택 (필수) --</option>
                {customers.filter(c => !c.type || c.type === '판매처' || c.type === '매출처').map(c => <option key={c.id} value={c.id}>{c.name} (보유 잔고: {c.balance.toLocaleString()})</option>)}
              </select>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400">우측에서 상품을 선택하세요.</div>
            ) : (
              cart.map(item => {
                const pInfo = products.find(p => p.id === item.id);
                const isOutOfStock = pInfo && item.qty > pInfo.stock;
                return (
                  <div key={item.id} className="border rounded-lg p-3 relative bg-white shadow-sm">
                    <button onClick={() => removeCartItem(item.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                    <div className="flex items-center">
                      <p className="font-bold text-gray-800 mr-2">{item.name}</p>
                      {item.originalPrice > item.price && <span className="bg-red-100 text-red-600 text-[10px] px-1 rounded font-bold mr-1">세일적용</span>}
                      {isOutOfStock && <span className="bg-orange-100 text-orange-600 text-[10px] px-1 rounded font-bold">미송포함</span>}
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{item.color} / {item.size} | ₩{item.price.toLocaleString()}</p>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center border rounded-md">
                        <button onClick={() => updateCartQty(item.id, -1)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200">-</button>
                        <span className="px-3 py-1 font-medium">{item.qty}</span>
                        <button onClick={() => updateCartQty(item.id, 1)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200">+</button>
                      </div>
                      <span className="font-bold text-gray-800">₩ {(item.price * item.qty).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-4 bg-gray-800 text-white rounded-t-xl">
            <div className="flex justify-between mb-2 text-gray-300 text-sm">
              <span>총 상품 금액</span>
              <span className="font-bold">₩ {cartTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-2 text-gray-300 text-sm">
              <span>추가 할인 금액</span>
              <div className="flex items-center">
                <span className="mr-2">- ₩</span>
                <input 
                  type="number" 
                  value={discountAmount === 0 ? '' : discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className="w-20 p-1 text-right text-black rounded outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex justify-between mb-4 text-blue-300 text-sm border-b border-gray-600 pb-3">
              <span>고객 잔고 차감</span>
              <span className="font-bold">- ₩ {usedBalancePreview.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg">최종 결제 금액</span>
              <span className="text-xl font-bold text-green-400">₩ {finalPaymentPreview.toLocaleString()}</span>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleTransaction('샘플')} className="bg-purple-500 hover:bg-purple-400 py-3 rounded-lg font-bold transition text-sm text-white flex justify-center items-center"><Printer size={16} className="mr-1"/> 샘플 출고</button>
                <button onClick={() => handleTransaction('반품')} className="bg-red-500 hover:bg-red-400 py-3 rounded-lg font-bold transition text-sm text-white flex justify-center items-center"><Printer size={16} className="mr-1"/> 반품 처리</button>
              </div>
              <button onClick={() => handleTransaction('결제')} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-lg font-bold transition text-lg text-white shadow-md flex justify-center items-center"><Printer size={20} className="mr-2"/> 결제 (판매)</button>
            </div>
          </div>
        </div>

        <div className="w-full md:w-2/3 p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">상품 목록</h2>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="상품명, 관리명, 색상 검색..." 
                value={salesSearchQuery}
                onChange={(e) => setSalesSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-full focus:ring-2 focus:ring-blue-500 outline-none w-72 transition-shadow shadow-sm" 
              />
            </div>
          </div>
          
          <div className="flex bg-gray-200 p-1 rounded-lg mb-6 w-max">
            {CATEGORIES.map(cat => (
              <button 
                key={cat}
                onClick={() => setSalesCategoryTab(cat)} 
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${salesCategoryTab === cat ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProductsForSales.map(product => {
              const hasSale = product.salePrice && product.salePrice < product.price;
              const discountRate = hasSale ? Math.round((1 - product.salePrice / product.price) * 100) : 0;
              
              return (
                <div 
                  key={product.id} 
                  onClick={() => handleAddToCart(product)}
                  className={`bg-white p-4 rounded-xl shadow-sm border border-gray-200 transition group relative overflow-hidden cursor-pointer hover:border-blue-500 hover:shadow-md ${
                    product.stock === 0 ? 'opacity-60' : ''
                  }`}
                >
                  {hasSale && <div className="absolute top-0 left-0 bg-red-600 text-white text-[11px] font-bold px-2 py-1 rounded-br-lg z-10 flex items-center"><Tag size={12} className="mr-1"/> -{discountRate}%</div>}
                  {product.stock === 0 && <div className="absolute top-0 right-0 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-bl-lg z-10">품절</div>}
                  
                  {product.image ? (
                    <img src={product.image} alt={product.name} className={`aspect-[3/4] w-full object-cover rounded-lg mb-3 ${product.stock === 0 ? 'grayscale' : ''}`} />
                  ) : (
                    <div className="aspect-[3/4] w-full bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-gray-400 transition"><Package size={32} /></div>
                  )}
                  
                  <h3 className="font-bold text-gray-800 text-sm truncate mt-2">{product.name}</h3>
                  <p className="text-xs text-gray-500 mb-2">{product.color} / {product.size}</p>
                  <div className="flex justify-between items-end">
                    {hasSale ? (
                      <div className="flex flex-col">
                        <span className="text-[11px] text-gray-400 line-through leading-none mb-0.5">₩ {product.price.toLocaleString()}</span>
                        <span className="font-bold text-red-600 leading-none">₩ {product.salePrice.toLocaleString()}</span>
                      </div>
                    ) : (
                      <span className="font-bold text-blue-600">₩ {product.price.toLocaleString()}</span>
                    )}
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded font-medium">재고: {product.stock}</span>
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
    );
  };

  const renderInventoryView = () => {
    const filteredInventory = products.filter(p => 
      p.name.toLowerCase().includes(inventorySearchQuery.toLowerCase()) || 
      (p.adminName && p.adminName.toLowerCase().includes(inventorySearchQuery.toLowerCase())) ||
      (p.color && p.color.toLowerCase().includes(inventorySearchQuery.toLowerCase())) ||
      p.id.toLowerCase().includes(inventorySearchQuery.toLowerCase())
    );

    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">상품 관리</h2>
          <div className="flex space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="상품명, 관리명, 색상 검색..." 
                value={inventorySearchQuery}
                onChange={(e) => setInventorySearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-64 transition-shadow shadow-sm" 
              />
            </div>
            <button 
              onClick={() => navigateTo('addProduct')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center hover:bg-blue-700"
            >
              <Plus size={18} className="mr-2"/> 신규 상품 등록
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-sm font-medium text-gray-500">상품코드</th>
                <th className="p-4 text-sm font-medium text-gray-500">상품명 (노출용 / 관리용)</th>
                <th className="p-4 text-sm font-medium text-gray-500">색상</th>
                <th className="p-4 text-sm font-medium text-gray-500">사이즈</th>
                <th className="p-4 text-sm font-medium text-gray-500">도매단가</th>
                <th className="p-4 text-sm font-medium text-gray-500">현재재고</th>
                <th className="p-4 text-sm font-medium text-gray-500 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInventory.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="p-4 text-sm font-medium text-gray-900">{p.id}</td>
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-10 h-14 object-cover rounded shadow-sm flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-14 bg-gray-100 flex items-center justify-center rounded shadow-sm text-gray-400 flex-shrink-0">
                          <Package size={16} />
                        </div>
                      )}
                      <div 
                        className="cursor-pointer group"
                        onClick={() => handleGoToProductDetail(p)}
                      >
                        <span className="text-sm font-bold text-blue-600 group-hover:underline flex items-center">
                          {p.name}
                          {p.salePrice && p.salePrice < p.price && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded">세일</span>}
                        </span>
                        {p.adminName && <p className="text-xs text-gray-400 mt-0.5">{p.adminName}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-600">{p.color}</td>
                  <td className="p-4 text-sm text-gray-600">{p.size}</td>
                  <td className="p-4 text-sm font-medium">₩ {p.price.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.stock === 0 ? 'bg-red-100 text-red-700' : p.stock < 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                      {p.stock} 장
                    </span>
                  </td>
                  <td className="p-4 text-sm text-center">
                    <button onClick={() => handleGoToProductDetail(p, true)} className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1 rounded mr-2">수정</button>
                    <button onClick={() => handleDeleteProduct(p.id)} className="text-red-600 hover:text-red-800 font-medium bg-red-50 px-3 py-1 rounded">삭제</button>
                  </td>
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">검색 결과가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAddProductView = () => {
    const handleAddProductChange = (e) => setAddProductForm({ ...addProductForm, [e.target.name]: e.target.value });
    const suppliers = customers.filter(c => c.type === '매입처');

    const handleImageUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAddProductForm({ ...addProductForm, image: reader.result });
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
      
      const newId = `P00${products.length + 1}`;
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
        supplierId: addProductForm.supplierId
      };
      
      setProducts([...products, newProduct]);
      saveItem('products', newProduct); 

      if (initialStockNum > 0) {
        const now = new Date();
        const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        const supplierName = addProductForm.supplierId ? customers.find(c => c.id === addProductForm.supplierId)?.name : '자체제작/기타';
        
        const historyItem = {
          id: `RS_${Date.now()}`,
          date: getTodayStr(),
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

      showAlert(`[${addProductForm.name}] 상품이 등록되었습니다.`, () => {
        setAddProductForm({ name: '', adminName: '', category: '상의', color: '', size: 'Free', price: '', stock: '', material: '', origin: '', image: '', supplierId: '' });
        goBack();
      });
    };

    const handleProductFormKeyDown = (e) => {
      if (e.key === 'Enter' && !modalConfig.isOpen) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return;
        
        e.preventDefault();
        const form = e.currentTarget;
        const inputs = Array.from(form.querySelectorAll('input:not([type="file"]), select, textarea, button[type="submit"]'));
        const index = inputs.indexOf(e.target);
        
        if (index > -1) {
          if (index < inputs.length - 1) {
             const nextEl = inputs[index + 1];
             nextEl.focus();
             if (nextEl.tagName === 'INPUT') setTimeout(() => nextEl.select(), 10);
          }
        }
      }
    };

    return (
      <div className="px-6 pb-6 pt-2">
        <div className="flex items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">신규 상품 등록</h2>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          <form onSubmit={handleSubmit} onKeyDown={handleProductFormKeyDown} className="space-y-6">
            
            <div className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition relative">
              {addProductForm.image ? (
                <div className="relative w-40 aspect-[3/4]">
                   <img src={addProductForm.image} alt="preview" className="w-full h-full object-cover rounded-lg shadow-sm" />
                   <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); setAddProductForm({...addProductForm, image: ''}); }} 
                    className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 shadow-md hover:bg-red-600 z-10"
                   >
                     <Trash2 size={16}/>
                   </button>
                </div>
              ) : (
                <>
                  <Upload size={48} className="text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600 font-bold mb-1">여기를 클릭하여 상품 이미지 등록</p>
                  <p className="text-xs text-gray-400">JPG, PNG 파일 첨부 가능</p>
                </>
              )}
              {!addProductForm.image && (
                <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" tabIndex="-1" />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">노출용 상품명 (고객용) *</label>
                <input type="text" name="name" value={addProductForm.name} onChange={handleAddProductChange} placeholder="예) 오버핏 카라 니트" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">관리용 상품명 (도매용)</label>
                <input type="text" name="adminName" value={addProductForm.adminName} onChange={handleAddProductChange} placeholder="예) A-01 카라니트" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">분류</label>
                <select name="category" value={addProductForm.category} onChange={handleAddProductChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="상의">상의</option>
                  <option value="하의">하의</option>
                  <option value="세트">세트</option>
                  <option value="아우터">아우터</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">색상</label>
                <input type="text" name="color" value={addProductForm.color} onChange={handleAddProductChange} placeholder="예) 베이지" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">사이즈</label>
                <select name="size" value={addProductForm.size} onChange={handleAddProductChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="Free">Free</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">도매단가 (원) *</label>
                <input type="number" name="price" value={addProductForm.price} onChange={handleAddProductChange} placeholder="예) 18000" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">매입처</label>
                <select name="supplierId" value={addProductForm.supplierId} onChange={handleAddProductChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="">-- 매입처 선택 (선택사항) --</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">초기 재고수량 (장)</label>
                <input type="number" name="stock" value={addProductForm.stock} onChange={handleAddProductChange} placeholder="예) 50" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">제조국</label>
                <input type="text" name="origin" value={addProductForm.origin} onChange={handleAddProductChange} placeholder="예) 대한민국" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">혼용률</label>
                <input type="text" name="material" value={addProductForm.material} onChange={handleAddProductChange} placeholder="예) 면 80%, 폴리 20%" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button type="button" onClick={goBack} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium" tabIndex="-1">취소</button>
              <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">상품 등록</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderProductDetailView = () => {
    if (!selectedProduct) return null;

    const suppliers = customers.filter(c => c.type === '매입처');

    const handleRestock = () => {
      if (!productRestockSupplierId) {
        showAlert('매입처를 선택하세요.');
        return;
      }

      const qty = Number(productRestockQty);
      if (qty > 0) {
        const newRestockedQty = (selectedProduct.restockedQty || 0) + qty;
        const updatedProduct = { ...selectedProduct, stock: selectedProduct.stock + qty, restockedQty: newRestockedQty };
        setProducts(products.map(p => p.id === selectedProduct.id ? updatedProduct : p));
        setSelectedProduct(updatedProduct);
        saveItem('products', updatedProduct); 

        const now = new Date();
        const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        const supplierName = customers.find(c => c.id === productRestockSupplierId)?.name;

        const historyItem = {
          id: `RS_${Date.now()}`,
          date: getTodayStr(),
          time: timeStr,
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          color: selectedProduct.color,
          size: selectedProduct.size,
          supplier: supplierName,
          qty: qty,
          type: '재입고'
        };
        saveItem('restockHistory', historyItem);

        setProductRestockQty('');
        setProductRestockSupplierId('');
        showAlert(`${qty}장이 추가 입고되었습니다.\n(입고 내역에 저장됨)`);
      } else {
        showAlert('추가할 입고 수량을 올바르게 입력하세요.');
      }
    };

    const handleEditImageUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setProductEditForm({ ...productEditForm, image: reader.result });
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
        stock: newStock
      };
      setProducts(products.map(p => p.id === updated.id ? updated : p));
      saveItem('products', updated); 
      setSelectedProduct(updated);
      setProductDetailEditMode(false);
      showAlert('상품 정보가 성공적으로 수정되었습니다.');
    };

    const hasSale = selectedProduct.salePrice && selectedProduct.salePrice < selectedProduct.price;
    const discountRate = hasSale ? Math.round((1 - selectedProduct.salePrice / selectedProduct.price) * 100) : 0;

    return (
      <div className="px-6 pb-6 pt-2">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <h2 className="text-2xl font-bold text-gray-800">상품 상세 정보</h2>
          </div>
          <div className="space-x-2">
            {productDetailEditMode ? (
              <>
                <button onClick={() => setProductDetailEditMode(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">취소</button>
                <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">수정사항 저장</button>
              </>
            ) : (
              <>
                <button onClick={() => { setProductEditForm(selectedProduct); setProductDetailEditMode(true); }} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">수정</button>
                <button onClick={() => handleDeleteProduct(selectedProduct.id)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium">삭제</button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-4xl flex flex-col md:flex-row gap-8">
          
          <div className="w-full md:w-1/3 aspect-[3/4] bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 overflow-hidden relative group">
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
                <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
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
                  <input type="text" value={productEditForm.name} onChange={e => setProductEditForm({...productEditForm, name: e.target.value})} className="w-full text-xl font-bold border-b border-gray-300 pb-1 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">관리용 상품명 (도매용)</label>
                  <input type="text" value={productEditForm.adminName || ''} onChange={e => setProductEditForm({...productEditForm, adminName: e.target.value})} className="w-full text-md border-b border-gray-300 pb-1 focus:border-blue-500 outline-none" placeholder="비워두면 노출되지 않습니다" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-gray-50 p-3 rounded-lg border">
                    <label className="block text-xs text-gray-500 mb-1">정상가 (원)</label>
                    <input type="number" value={productEditForm.price} onChange={e => setProductEditForm({...productEditForm, price: e.target.value})} className="w-full font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none" />
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                    <label className="block text-xs text-red-500 mb-1 font-bold">세일 할인가 (원)</label>
                    <input type="number" value={productEditForm.salePrice || ''} placeholder="할인 없을시 비워둠" onChange={e => setProductEditForm({...productEditForm, salePrice: e.target.value})} className="w-full font-bold text-red-600 bg-transparent border-b border-red-300 focus:border-red-500 outline-none placeholder-red-300" />
                  </div>
                  
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <label className="block text-xs text-blue-700 mb-1 font-bold">초기 재고수량 (장)</label>
                    <input type="number" value={productEditForm.initialStock ?? productEditForm.stock} onChange={e => setProductEditForm({...productEditForm, initialStock: e.target.value})} className="w-full font-bold text-blue-800 bg-transparent border-b border-blue-300 focus:border-blue-500 outline-none" />
                  </div>

                  <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                    <label className="block text-xs text-green-700 mb-1 font-bold">추가 입고 누적수량 (장)</label>
                    <input type="number" value={productEditForm.restockedQty || 0} onChange={e => setProductEditForm({...productEditForm, restockedQty: e.target.value})} className="w-full font-bold text-green-800 bg-transparent border-b border-green-300 focus:border-green-500 outline-none" />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">분류</label>
                    <select value={productEditForm.category || '상의'} onChange={e => setProductEditForm({...productEditForm, category: e.target.value})} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="상의">상의</option>
                      <option value="하의">하의</option>
                      <option value="세트">세트</option>
                      <option value="아우터">아우터</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">색상</label>
                    <input type="text" value={productEditForm.color} onChange={e => setProductEditForm({...productEditForm, color: e.target.value})} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" />
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
                    <input type="text" value={productEditForm.material || ''} onChange={e => setProductEditForm({...productEditForm, material: e.target.value})} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">제조국</label>
                    <input type="text" value={productEditForm.origin || ''} onChange={e => setProductEditForm({...productEditForm, origin: e.target.value})} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6 border-b pb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{selectedProduct.id}</span>
                    <div className="flex space-x-2">
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">초기 재고: {selectedProduct.initialStock ?? selectedProduct.stock}장</span>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-200">누적 입고: {selectedProduct.restockedQty || 0}장</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${selectedProduct.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>현재 재고: {selectedProduct.stock}장</span>
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
                </div>

                <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-gray-800">추가 사입 (재입고)</p>
                    <p className="text-xs text-gray-500">매입처와 수량을 입력하여 재고 및 입고내역을 갱신하세요.</p>
                  </div>
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <select
                      value={productRestockSupplierId} onChange={(e) => setProductRestockSupplierId(e.target.value)}
                      className="w-32 p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                    >
                      <option value="">-- 매입처 선택 --</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input
                      type="number" value={productRestockQty} onChange={(e) => setProductRestockQty(e.target.value)}
                      placeholder="수량" className="w-20 p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-right"
                    />
                    <button onClick={handleRestock} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 whitespace-nowrap">입고 반영</button>
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
    const filteredHistory = restockHistory.filter(h => 
      h.date === restockSearchDate &&
      (h.productName.toLowerCase().includes(restockSearchQuery.toLowerCase()) ||
       (h.supplier && h.supplier.toLowerCase().includes(restockSearchQuery.toLowerCase())))
    );

    const handleDeleteRestock = (historyId) => {
      showConfirm('해당 입고 내역을 삭제하시겠습니까?\n(삭제 시 해당 상품의 현재 재고 및 누적 입고수량에서 수량이 차감됩니다)', () => {
        const log = restockHistory.find(r => r.id === historyId);
        if (!log) return;

        setRestockHistory(prev => prev.filter(r => r.id !== historyId));
        deleteItem('restockHistory', historyId);

        const pIdx = products.findIndex(p => p.id === log.productId);
        if (pIdx !== -1) {
          const updatedProduct = { ...products[pIdx] };
          updatedProduct.stock = Math.max(0, updatedProduct.stock - log.qty);
          updatedProduct.restockedQty = Math.max(0, (updatedProduct.restockedQty || 0) - log.qty);
          
          setProducts(prev => prev.map(p => p.id === log.productId ? updatedProduct : p));
          saveItem('products', updatedProduct);

          if (selectedProduct && selectedProduct.id === log.productId) {
            setSelectedProduct(updatedProduct);
          }
        }
        showAlert('입고 내역이 삭제되었으며, 재고가 차감 복구되었습니다.');
      });
    };

    const dailyTotalRestockQty = filteredHistory.reduce((sum, item) => sum + item.qty, 0);

    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">입고 내역</h2>
          <div className="flex space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="상품명 또는 매입처 검색..." 
                value={restockSearchQuery}
                onChange={(e) => setRestockSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-64 transition-shadow shadow-sm" 
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <h3 className="font-bold text-gray-800">일자별 입고 현황</h3>
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
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-sm font-medium text-gray-500">시간</th>
                <th className="p-4 text-sm font-medium text-gray-500">매입처</th>
                <th className="p-4 text-sm font-medium text-gray-500">상품명</th>
                <th className="p-4 text-sm font-medium text-gray-500">옵션 (색상/사이즈)</th>
                <th className="p-4 text-sm font-medium text-gray-500 text-center">구분</th>
                <th className="p-4 text-sm font-medium text-gray-500 text-right">입고 수량</th>
                <th className="p-4 text-sm font-medium text-gray-500 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredHistory.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="p-4 text-sm text-gray-600">{log.time}</td>
                  <td className="p-4 text-sm font-bold text-gray-800">{log.supplier}</td>
                  <td className="p-4 text-sm text-blue-600 font-bold cursor-pointer hover:underline" onClick={() => {
                    const prod = products.find(p => p.id === log.productId);
                    if (prod) { handleGoToProductDetail(prod); }
                  }}>
                    {log.productName}
                  </td>
                  <td className="p-4 text-sm text-gray-600">{log.color} / {log.size}</td>
                  <td className="p-4 text-sm text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${log.type === '초기입고' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                      {log.type || '재입고'}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-bold text-green-600 text-right">+{log.qty}장</td>
                  <td className="p-4 text-sm text-center">
                    <button onClick={() => handleDeleteRestock(log.id)} className="text-red-500 border border-red-200 bg-red-50 px-2 py-1 rounded text-xs hover:bg-red-100 font-bold transition">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {filteredHistory.length === 0 && (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">해당 날짜의 입고 내역이 없습니다.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-green-50 border-t-2 border-green-200">
              <tr>
                <td colSpan="5" className="p-4 text-sm font-bold text-center text-gray-800">총 입고 합계</td>
                <td className="p-4 text-sm font-bold text-right text-green-700">{dailyTotalRestockQty}장</td>
                <td className="p-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderSalesReportView = () => {
    const filteredDailySales = dailySales.filter(sale => sale.date === reportDate);
    const filteredMonthlySales = monthlySales.filter(day => day.date.startsWith(reportMonth));

    const sortedMonthlySales = [...filteredMonthlySales].sort((a, b) => {
      if (a[salesReportSort.key] < b[salesReportSort.key]) return salesReportSort.direction === 'asc' ? -1 : 1;
      if (a[salesReportSort.key] > b[salesReportSort.key]) return salesReportSort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    const handleSort = (key) => {
      let direction = 'desc';
      if (salesReportSort.key === key && salesReportSort.direction === 'desc') direction = 'asc';
      setSalesReportSort({ key, direction });
    };

    const getDayOfWeek = (dateStr) => {
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return days[new Date(dateStr).getDay()];
    };

    const dailyTotalQty = filteredDailySales.reduce((sum, item) => sum + (item.type === '판매' ? item.qty : -item.qty), 0);
    const dailyNetTotal = filteredDailySales.reduce((sum, item) => sum + (item.actualPayment !== undefined ? item.actualPayment : item.total), 0);

    const monthlyTotalCount = filteredMonthlySales.reduce((sum, item) => sum + item.count, 0);
    const monthlyTotalSales = filteredMonthlySales.reduce((sum, item) => sum + item.sales, 0);
    const monthlyTotalReturns = filteredMonthlySales.reduce((sum, item) => sum + item.returns, 0);
    const monthlyNetSales = filteredMonthlySales.reduce((sum, item) => sum + item.netSales, 0);

    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">매출 현황</h2>
          <div className="flex space-x-2">
            <button 
              onClick={() => setSalesReportTab('daily')}
              className={`px-4 py-2 font-medium rounded-md border transition-colors ${salesReportTab === 'daily' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Calendar size={16} className="inline mr-2"/>일별 매출
            </button>
            <button 
              onClick={() => setSalesReportTab('monthly')}
              className={`px-4 py-2 font-medium rounded-md border transition-colors ${salesReportTab === 'monthly' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <BarChart size={16} className="inline mr-2"/>월별 매출
            </button>
          </div>
        </div>

        {salesReportTab === 'daily' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
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
                    onClick={() => setReportDate(today)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md text-sm font-bold hover:bg-blue-100 transition"
                  >
                    오늘
                  </button>
                </div>
              </div>
            </div>
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 text-sm font-medium text-gray-500">시간</th>
                  <th className="p-4 text-sm font-medium text-gray-500">거래처</th>
                  <th className="p-4 text-sm font-medium text-gray-500">거래 내역</th>
                  <th className="p-4 text-sm font-medium text-gray-500 text-center">구분</th>
                  <th className="p-4 text-sm font-medium text-gray-500 text-right">총 수량</th>
                  <th className="p-4 text-sm font-medium text-gray-500 text-right">상품금액</th>
                  <th className="p-4 text-sm font-medium text-gray-500 text-right">실결제액</th>
                  <th className="p-4 text-sm font-medium text-gray-500 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDailySales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-600">{sale.time}</td>
                    <td className="p-4 text-sm font-bold text-gray-800">{sale.customerName}</td>
                    <td className="p-4 text-sm text-gray-800">{sale.productName}</td>
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
                      ₩ {Math.abs(sale.actualPayment ?? sale.total).toLocaleString()}
                    </td>
                    <td className="p-4 text-sm text-center">
                      <button onClick={() => handleCancelSale(sale.id)} className="text-red-500 border border-red-200 bg-red-50 px-2 py-1 rounded text-xs hover:bg-red-100 font-bold transition">
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDailySales.length === 0 && (
                  <tr><td colSpan="8" className="p-8 text-center text-gray-500">해당 날짜의 판매 내역이 없습니다.</td></tr>
                )}
              </tbody>
              <tfoot className="bg-blue-50 border-t-2 border-blue-200">
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
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
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
                    onClick={() => {
                      setReportDate(today);
                      setReportMonth(today.substring(0, 7));
                    }}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md text-sm font-bold hover:bg-blue-100 transition"
                  >
                    이번 달
                  </button>
                </div>
              </div>
            </div>
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('date')}>
                    일자 {salesReportSort.key === 'date' && (salesReportSort.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="p-4 text-sm font-medium text-gray-500 text-right cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('count')}>
                    판매 건수 {salesReportSort.key === 'count' && (salesReportSort.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="p-4 text-sm font-medium text-gray-500 text-right cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('sales')}>
                    총 판매액 {salesReportSort.key === 'sales' && (salesReportSort.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="p-4 text-sm font-medium text-gray-500 text-right cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('returns')}>
                    반품액 {salesReportSort.key === 'returns' && (salesReportSort.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="p-4 text-sm font-medium text-gray-500 text-right cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('netSales')}>
                    순매출액 {salesReportSort.key === 'netSales' && (salesReportSort.direction === 'asc' ? '▲' : '▼')}
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
                  </tr>
                ))}
                {sortedMonthlySales.length === 0 && (
                  <tr><td colSpan="5" className="p-8 text-center text-gray-500">해당 월의 매출 데이터가 없습니다.</td></tr>
                )}
              </tbody>
              <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                <tr>
                  <td className="p-4 text-sm font-bold text-center text-gray-800">총 합계</td>
                  <td className="p-4 text-sm font-bold text-right text-gray-800">{monthlyTotalCount}건</td>
                  <td className="p-4 text-sm font-bold text-right text-gray-800">₩ {monthlyTotalSales.toLocaleString()}</td>
                  <td className="p-4 text-sm font-bold text-right text-red-500">₩ {monthlyTotalReturns.toLocaleString()}</td>
                  <td className="p-4 text-sm font-bold text-right text-blue-600">₩ {monthlyNetSales.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderCustomerView = () => {
    const filteredCustomers = customers.filter(c => {
      const isSalesCustomer = !c.type || c.type === '판매처' || c.type === '매출처';
      const typeMatch = customerListTab === '전체' || (customerListTab === '판매처' ? isSalesCustomer : c.type === '매입처');
      const searchMatch = c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || c.id.toLowerCase().includes(customerSearchQuery.toLowerCase());
      return typeMatch && searchMatch;
    });

    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-gray-800">업체 내역</h2>
            <div className="flex bg-gray-200 p-1 rounded-lg">
              <button onClick={() => setCustomerListTab('전체')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${customerListTab === '전체' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>전체</button>
              <button onClick={() => setCustomerListTab('판매처')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${customerListTab === '판매처' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>판매처</button>
              <button onClick={() => setCustomerListTab('매입처')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${customerListTab === '매입처' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>매입처</button>
            </div>
          </div>
          <div className="flex space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="업체명 검색..." 
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-64 transition-shadow shadow-sm" 
              />
            </div>
            <button onClick={() => navigateTo('addCustomer')} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center hover:bg-blue-700">
              <Plus size={18} className="mr-2"/> 신규 등록
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-sm font-medium text-gray-500">업체코드</th>
                <th className="p-4 text-sm font-medium text-gray-500 text-center">구분</th>
                <th className="p-4 text-sm font-medium text-gray-500">업체명 (상호)</th>
                <th className="p-4 text-sm font-medium text-gray-500">연락처</th>
                <th className="p-4 text-sm font-medium text-gray-500">사업자번호</th>
                <th className="p-4 text-sm font-medium text-gray-500">보유 잔고 (예치금)</th>
                <th className="p-4 text-sm font-medium text-gray-500">메모</th>
                <th className="p-4 text-sm font-medium text-gray-500 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
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
                  <td className="p-4 text-sm text-gray-600">{c.bizNum || '-'}</td>
                  <td className="p-4 text-sm font-bold"><span className={c.balance > 0 ? 'text-blue-600' : 'text-gray-800'}>₩ {c.balance.toLocaleString()}</span></td>
                  <td className="p-4 text-sm text-gray-500">{c.memo}</td>
                  <td className="p-4 text-sm text-center">
                    <button onClick={() => handleGoToCustomerDetail(c, true)} className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1 rounded text-xs mr-2">수정</button>
                    <button onClick={() => handleDeleteCustomer(c.id)} className="text-red-600 hover:text-red-800 font-medium bg-red-50 px-3 py-1 rounded text-xs">삭제</button>
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
    );
  };

  const renderCustomerDetailView = () => {
    if (!selectedCustomerDetail) return null;

    const handleSaveEdit = () => {
      if (!customerEditForm.name) return showAlert("거래처명(상호)을 입력해주세요.");
      
      const updated = { ...customerEditForm, balance: Number(customerEditForm.balance) };
      setCustomers(customers.map(c => c.id === updated.id ? updated : c));
      saveItem('customers', updated); 
      setSelectedCustomerDetail(updated);
      setCustomerDetailEditMode(false);
      showAlert('거래처 정보가 성공적으로 수정되었습니다.');
    };

    const displayType = (!selectedCustomerDetail.type || selectedCustomerDetail.type === '판매처' || selectedCustomerDetail.type === '매출처') ? '판매처' : '매입처';

    return (
      <div className="px-6 pb-6 pt-2">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <h2 className="text-2xl font-bold text-gray-800">거래처 상세 정보</h2>
          </div>
          <div className="space-x-2">
            {customerDetailEditMode ? (
              <>
                <button onClick={() => setCustomerDetailEditMode(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">취소</button>
                <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">수정사항 저장</button>
              </>
            ) : (
              <>
                <button onClick={() => { setCustomerEditForm(selectedCustomerDetail); setCustomerDetailEditMode(true); }} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">수정</button>
                <button onClick={() => handleDeleteCustomer(selectedCustomerDetail.id)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium">삭제</button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-4xl">
          {customerDetailEditMode ? (
            <div className="space-y-6">
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
                  <input type="text" value={customerEditForm.name} onChange={e => setCustomerEditForm({...customerEditForm, name: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
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
                  <input type="number" value={customerEditForm.balance} onChange={e => setCustomerEditForm({...customerEditForm, balance: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">메모 (참고사항)</label>
                <textarea value={customerEditForm.memo} onChange={e => setCustomerEditForm({...customerEditForm, memo: e.target.value})} rows="3" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
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
                <div className="text-right">
                  <p className="text-sm text-gray-500 mb-1">보유 잔고</p>
                  <p className={`text-2xl font-bold ${selectedCustomerDetail.balance > 0 ? 'text-blue-600' : 'text-gray-800'}`}>₩ {selectedCustomerDetail.balance.toLocaleString()}</p>
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
          )}
        </div>
      </div>
    );
  };

  const renderAddCustomerView = () => {
    const handleAddCustomerChange = (e) => setAddCustomerForm({ ...addCustomerForm, [e.target.name]: e.target.value });

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!addCustomerForm.name) return showAlert("거래처명(상호)을 입력해주세요.");
      
      const newCustomer = { id: `C00${customers.length + 1}`, type: addCustomerForm.type, name: addCustomerForm.name, phone: addCustomerForm.phone, bizNum: addCustomerForm.bizNum, balance: 0, memo: addCustomerForm.memo };
      setCustomers([...customers, newCustomer]);
      saveItem('customers', newCustomer); 

      showAlert(`[${addCustomerForm.name}] 거래처가 성공적으로 등록되었습니다.`, () => {
        setAddCustomerForm({ type: '판매처', name: '', phone: '', bizNum: '', memo: '' });
        goBack();
      });
    };

    const handleCustomerFormKeyDown = (e) => {
      if (e.key === 'Enter' && !modalConfig.isOpen) {
        if (e.target.name === 'memo' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
        
        e.preventDefault();
        const form = e.currentTarget;
        const inputs = Array.from(form.querySelectorAll('input:not([type="radio"]), select, textarea, button[type="submit"]'));
        const index = inputs.indexOf(e.target);
        
        if (index > -1) {
          if (index < inputs.length - 1) {
             const nextEl = inputs[index + 1];
             nextEl.focus();
             if (nextEl.tagName === 'INPUT') setTimeout(() => nextEl.select(), 10);
          }
        }
      }
    };

    return (
      <div className="px-6 pb-6 pt-2">
        <div className="flex items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">신규 거래처 등록</h2>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl">
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
              <div><label className="block text-sm font-medium text-gray-700 mb-2">거래처명 (상호) *</label><input type="text" name="name" value={addCustomerForm.name} onChange={handleAddCustomerChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">연락처</label><input type="text" name="phone" value={addCustomerForm.phone} onChange={handleAddCustomerChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-2">사업자번호</label><input type="text" name="bizNum" value={addCustomerForm.bizNum} onChange={handleAddCustomerChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">메모 (참고사항)</label><textarea name="memo" value={addCustomerForm.memo} onChange={handleAddCustomerChange} rows="3" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="엔터키는 줄바꿈, 다음 칸 이동은 탭(Tab)키를 이용하세요."></textarea></div>
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button type="button" onClick={goBack} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium" tabIndex="-1">취소</button>
              <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">거래처 등록</button>
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
    const isMisong = misongTab === 'misong';
    const currentList = isMisong ? misongList : sampleList;

    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">미송 / 샘플 내역</h2>
          <div className="flex space-x-2">
             <button onClick={() => setMisongTab('misong')} className={`px-4 py-2 font-medium rounded-md border transition-colors ${isMisong ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>미송 내역</button>
             <button onClick={() => setMisongTab('sample')} className={`px-4 py-2 font-medium rounded-md border transition-colors ${!isMisong ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>샘플 내역</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-sm font-medium text-gray-500">접수일자</th>
                <th className="p-4 text-sm font-medium text-gray-500">거래처명</th>
                <th className="p-4 text-sm font-medium text-gray-500">상품정보</th>
                <th className="p-4 text-sm font-medium text-gray-500">{isMisong ? '전체 / 출고 수량' : '출고 / 회수 수량'}</th>
                <th className="p-4 text-sm font-medium text-gray-500 text-center w-28">상태</th>
                <th className="p-4 text-sm font-medium text-gray-500 text-center w-32">관리</th>
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
                  <td className="p-4 text-sm text-gray-600">{item.productName}</td>
                  
                  {isMisong ? (
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
                          ) : (
                            <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded text-[11px] font-bold border border-purple-200 w-24 text-center inline-block">출고완료</span>
                          )}
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
                            <span className="bg-gray-100 text-gray-600 px-2 py-1.5 rounded text-xs font-bold border border-gray-200">출고완료</span>
                          ) : item.returnedQty < item.qty ? (
                            <span className="bg-blue-50 text-blue-600 px-2 py-1.5 rounded text-xs font-bold border border-blue-200">부분회수</span>
                          ) : (
                            <span className="bg-purple-50 text-purple-600 px-2 py-1.5 rounded text-xs font-bold border border-purple-200">회수완료</span>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                  
                  <td className="p-4 text-sm align-middle">
                    <div className="flex space-x-2 justify-center">
                      <button 
                        onClick={() => handleSaveItemStatus(item, isMisong)} 
                        disabled={isMisong ? item.shippedQty === item.savedShippedQty : item.returnedQty === item.savedReturnedQty} 
                        className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
                          (isMisong ? item.shippedQty === item.savedShippedQty : item.returnedQty === item.savedReturnedQty) 
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600'
                        }`}
                      >
                        저장
                      </button>
                      <button onClick={() => handleDeleteItem(item, isMisong)} className="text-red-500 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-50 border border-red-200 transition-colors">삭제</button>
                    </div>
                  </td>
                </tr>
              );
              })}
              {currentList.length === 0 && (<tr><td colSpan="6" className="p-8 text-center text-gray-500">내역이 없습니다.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard': return renderDashboardView();
      case 'sales': return renderSalesView();
      case 'salesReport': return renderSalesReportView();
      case 'inventory': return renderInventoryView();
      case 'productDetail': return renderProductDetailView();
      case 'addProduct': return renderAddProductView();
      case 'restockHistory': return renderRestockHistoryView();
      case 'customers': return renderCustomerView();
      case 'customerDetail': return renderCustomerDetailView();
      case 'addCustomer': return renderAddCustomerView();
      case 'misong': return renderMisongView();
      case 'settings': return renderSettingsView();
      default: return renderDashboardView();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-5 flex items-center border-b border-gray-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl mr-3 shadow-sm">P</div>
          <div>
            <h1 className="font-bold text-lg tracking-wide">POS SYSTEM</h1>
            <p className="text-xs text-gray-400">의류 도매 매장관리</p>
          </div>
        </div>
        
        <nav className="flex-1 py-4 space-y-1">
          {menuOrder.map((menuId, index) => {
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center text-gray-600"><span className="font-bold text-gray-800 mr-2">동대문 청평화 2층 가 12호</span> 매장</div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center text-gray-600"><Clock className="mr-2" size={18} /><HeaderClock /></div>
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold">관</div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 flex flex-col relative">
          {menuHistory.length > 1 && !['dashboard', 'sales', 'salesReport', 'inventory', 'restockHistory', 'customers', 'misong'].includes(activeMenu) && (
            <div className="px-6 pt-6 pb-2">
              <button onClick={goBack} className="text-gray-500 hover:text-gray-800 transition flex items-center font-bold text-sm w-max">
                <ArrowLeft size={16} className="mr-1"/> 뒤로가기
              </button>
            </div>
          )}
          {renderContent()}
        </main>
      </div>

      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 transform transition-all">
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
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition text-sm"
                >
                  취소
                </button>
              )}
              <button 
                onClick={() => {
                  if (modalConfig.onConfirm) modalConfig.onConfirm();
                  closeModal();
                }} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition text-sm"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}