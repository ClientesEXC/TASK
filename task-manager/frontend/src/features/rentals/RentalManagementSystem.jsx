import React, { useState, useEffect } from 'react';
import { Plus, ShoppingCart, Package, DollarSign, Search, Edit2, Trash2, X, FileText } from 'lucide-react';
import {
    listProducts,
    createProduct,
    updateProduct,
    deleteProduct,
} from '../../services/products';

export default function RentalManagementSystem() {
    // --- Productos (CRUD + UI) ---
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showProductForm, setShowProductForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);

    // Paginación
    const [page, setPage] = useState(1);
    const [perPage] = useState(12);
    const [totalPages, setTotalPages] = useState(1);

    // Form de producto
    const [productForm, setProductForm] = useState({
        name: '',
        description: '',
        price: '',
        stock: '',
        image: null,
    });

    // --- Clientes / Alquileres (de momento local hasta cablear API) ---
    const [clients, setClients] = useState([]);
    const [rentals, setRentals] = useState([]);
    const [cart, setCart] = useState([]);
    const [activeTab, setActiveTab] = useState('products');
    const [showClientForm, setShowClientForm] = useState(false);
    const [currentClient, setCurrentClient] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedRental, setSelectedRental] = useState(null);

    const [clientForm, setClientForm] = useState({
        name: '',
        cedula: '',
        address: '',
        phone: '',
        hasDeposit: false,
        hasCollateral: false,
        depositAmount: ''
    });

    const [rentalDates, setRentalDates] = useState({
        deliveryDate: '',
        returnDate: ''
    });

    const [paymentForm, setPaymentForm] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    // --------- Efecto: cargar productos (filtrado + paginado) ----------
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setIsLoadingProducts(true);
                const { items, meta } = await listProducts({
                    q: searchTerm,
                    page,
                    per_page: perPage,
                    sort: 'created_at',
                    dir: 'desc',
                    is_active: true,
                });
                if (!cancelled) {
                    setProducts(items);
                    setTotalPages(meta?.total_pages || 1);
                }
            } catch (e) {
                console.error(e);
                alert(e.userMessage || 'Error cargando productos');
            } finally {
                if (!cancelled) setIsLoadingProducts(false);
            }
        })();
        return () => { cancelled = true; };
    }, [searchTerm, page, perPage]);

    // Reset de página al cambiar búsqueda
    useEffect(() => { setPage(1); }, [searchTerm]);

    // --------- Handlers de Productos (usando API) ----------
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProductForm((f) => ({ ...f, image: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveProduct = async () => {
        if (!productForm.name || productForm.price === '' || productForm.stock === '') {
            alert('Por favor completa todos los campos obligatorios');
            return;
        }
        try {
            if (editingProduct) {
                const { updated } = await updateProduct(editingProduct.id, productForm, editingProduct.version);
                setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
            } else {
                const created = await createProduct(productForm);
                setProducts(prev => [created, ...prev]);
            }
            setShowProductForm(false);
            setEditingProduct(null);
            setProductForm({ name: '', description: '', price: '', stock: '', image: null });
        } catch (e) {
            alert(e.userMessage || 'No se pudo guardar el producto');
        }
    };

    const handleDeleteProduct = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este producto?')) {
            try {
                await deleteProduct(id);
                setProducts(prev => prev.filter(p => p.id !== id));
            } catch (e) {
                alert(e.userMessage || 'No se pudo eliminar');
            }
        }
    };

    // --------- Carrito ----------
    const handleAddToCart = (product) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            setCart(cart.map(item =>
                item.id === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    const handleRemoveFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const handleUpdateCartQuantity = (id, quantity) => {
        const q = Number(quantity);
        if (q < 1) {
            handleRemoveFromCart(id);
            return;
        }
        setCart(cart.map(item =>
            item.id === id ? { ...item, quantity: q } : item
        ));
    };

    // --------- Clientes (local por ahora) ----------
    const handleSaveClient = () => {
        if (!clientForm.name || !clientForm.cedula || !clientForm.phone) {
            alert('Por favor completa los campos obligatorios');
            return;
        }
        const newClient = {
            ...clientForm,
            id: Date.now()
        };
        setClients(prev => [newClient, ...prev]);
        setCurrentClient(newClient);
        setShowClientForm(false);
        setClientForm({
            name: '',
            cedula: '',
            address: '',
            phone: '',
            hasDeposit: false,
            hasCollateral: false,
            depositAmount: ''
        });
    };

    // --------- Alquiler (local por ahora) ----------
    const handleCompleteRental = () => {
        if (cart.length === 0 || !currentClient || !rentalDates.deliveryDate || !rentalDates.returnDate) {
            alert('Por favor completa todos los datos necesarios');
            return;
        }

        const totalAmount = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        const depositAmount = parseFloat(currentClient.depositAmount) || 0;

        const newRental = {
            id: Date.now(),
            client: currentClient,
            items: cart,
            deliveryDate: rentalDates.deliveryDate,
            returnDate: rentalDates.returnDate,
            totalAmount,
            paidAmount: depositAmount,
            remainingAmount: totalAmount - depositAmount,
            status: 'active',
            payments: depositAmount > 0 ? [{
                amount: depositAmount,
                date: new Date().toISOString().split('T')[0],
                notes: 'Abono inicial'
            }] : [],
            createdAt: new Date().toISOString()
        };

        const updatedProducts = products.map(product => {
            const cartItem = cart.find(item => item.id === product.id);
            if (cartItem) {
                return {
                    ...product,
                    availableStock: product.availableStock - cartItem.quantity
                };
            }
            return product;
        });

        setRentals(prev => [...prev, newRental]);
        setProducts(updatedProducts);

        setCart([]);
        setCurrentClient(null);
        setRentalDates({ deliveryDate: '', returnDate: '' });
        alert('Alquiler registrado exitosamente');
        setActiveTab('rentals');
    };

    const handleAddPayment = () => {
        if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
            alert('Por favor ingresa un monto válido');
            return;
        }

        const amount = parseFloat(paymentForm.amount);
        const rental = rentals.find(r => r.id === selectedRental.id);

        if (amount > rental.remainingAmount) {
            alert('El monto excede el saldo pendiente');
            return;
        }

        const newPayment = {
            amount,
            date: paymentForm.date,
            notes: paymentForm.notes
        };

        const updatedRentals = rentals.map(r => {
            if (r.id === selectedRental.id) {
                return {
                    ...r,
                    payments: [...r.payments, newPayment],
                    paidAmount: r.paidAmount + amount,
                    remainingAmount: r.remainingAmount - amount
                };
            }
            return r;
        });

        setRentals(updatedRentals);
        setShowPaymentModal(false);
        setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
        setSelectedRental(null);
    };

    const handleReturnRental = (rentalId) => {
        if (window.confirm('¿Confirmar devolución del alquiler?')) {
            const rental = rentals.find(r => r.id === rentalId);

            const updatedProducts = products.map(product => {
                const rentalItem = rental.items.find(item => item.id === product.id);
                if (rentalItem) {
                    return {
                        ...product,
                        availableStock: product.availableStock + rentalItem.quantity
                    };
                }
                return product;
            });

            const updatedRentals = rentals.map(r =>
                r.id === rentalId ? { ...r, status: 'returned' } : r
            );

            setProducts(updatedProducts);
            setRentals(updatedRentals);
        }
    };

    const totalCart = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-blue-600 text-white p-6 shadow-lg">
                <h1 className="text-3xl font-bold">Sistema de Gestión de Alquileres</h1>
                <p className="text-blue-100 mt-2">Administra tus productos y alquileres</p>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                <div className="bg-white rounded-lg shadow mb-6">
                    <div className="flex border-b">
                        <button
                            onClick={() => setActiveTab('products')}
                            className={`flex items-center gap-2 px-6 py-4 font-medium ${activeTab === 'products' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
                        >
                            <Package size={20} />
                            Productos
                        </button>
                        <button
                            onClick={() => setActiveTab('rent')}
                            className={`flex items-center gap-2 px-6 py-4 font-medium ${activeTab === 'rent' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
                        >
                            <ShoppingCart size={20} />
                            Alquilar ({cart.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('rentals')}
                            className={`flex items-center gap-2 px-6 py-4 font-medium ${activeTab === 'rentals' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
                        >
                            <FileText size={20} />
                            Alquileres
                        </button>
                    </div>
                </div>

                {/* Pestaña Productos */}
                {activeTab === 'products' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex-1 max-w-md">
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Buscar productos..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => setShowProductForm(true)}
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                            >
                                <Plus size={20} />
                                Nuevo Producto
                            </button>
                        </div>

                        {showProductForm && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                                    <h2 className="text-xl font-bold mb-4">
                                        {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                                    </h2>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Nombre *</label>
                                            <input
                                                type="text"
                                                value={productForm.name}
                                                onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Descripción</label>
                                            <textarea
                                                value={productForm.description}
                                                onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                                                className="w-full border rounded px-3 py-2"
                                                rows="3"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Precio de Alquiler *</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={productForm.price}
                                                onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Stock Total *</label>
                                            <input
                                                type="number"
                                                value={productForm.stock}
                                                onChange={(e) => setProductForm({...productForm, stock: e.target.value})}
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Imagen</label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="w-full border rounded px-3 py-2"
                                            />
                                            {productForm.image && (
                                                <img src={productForm.image} alt="Preview" className="mt-2 h-32 object-cover rounded" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-6">
                                        <button
                                            onClick={handleSaveProduct}
                                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                        >
                                            Guardar
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowProductForm(false);
                                                setEditingProduct(null);
                                                setProductForm({ name: '', description: '', price: '', stock: '', image: null });
                                            }}
                                            className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Loader */}
                        {isLoadingProducts && (
                            <div className="text-center text-gray-500 py-8">Cargando productos...</div>
                        )}

                        {/* Grid de productos */}
                        {!isLoadingProducts && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {products.map(product => (
                                        <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                                            {product.image && (
                                                <img src={product.image} alt={product.name} className="w-full h-48 object-cover" />
                                            )}
                                            <div className="p-4">
                                                <h3 className="font-bold text-lg mb-2">{product.name}</h3>
                                                <p className="text-gray-600 text-sm mb-3">{product.description}</p>
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-2xl font-bold text-blue-600">${product.price}</span>
                                                    <span className="text-sm text-gray-600">
                            Disponible: {product.availableStock}/{product.stock}
                          </span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleAddToCart(product)}
                                                        disabled={product.availableStock === 0}
                                                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                                    >
                                                        Agregar
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingProduct(product); // mantiene version para optimistic locking
                                                            setProductForm({
                                                                name: product.name,
                                                                description: product.description || '',
                                                                price: product.price,
                                                                stock: product.stock,
                                                                image: product.image || null
                                                            });
                                                            setShowProductForm(true);
                                                        }}
                                                        className="bg-gray-200 p-2 rounded hover:bg-gray-300"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteProduct(product.id)}
                                                        className="bg-red-100 text-red-600 p-2 rounded hover:bg-red-200"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Paginación */}
                                <div className="flex items-center justify-center gap-2 mt-6">
                                    <button
                                        className="px-3 py-2 border rounded disabled:opacity-50"
                                        disabled={page <= 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                    >
                                        Anterior
                                    </button>
                                    <span className="text-sm">Página {page} de {totalPages}</span>
                                    <button
                                        className="px-3 py-2 border rounded disabled:opacity-50"
                                        disabled={page >= totalPages}
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Pestaña Carrito / Alquilar */}
                {activeTab === 'rent' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-lg shadow p-6">
                                <h2 className="text-xl font-bold mb-4">Carrito de Alquiler</h2>
                                {cart.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">El carrito está vacío</p>
                                ) : (
                                    <div className="space-y-4">
                                        {cart.map(item => (
                                            <div key={item.id} className="flex items-center gap-4 border-b pb-4">
                                                {item.image && (
                                                    <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded" />
                                                )}
                                                <div className="flex-1">
                                                    <h3 className="font-semibold">{item.name}</h3>
                                                    <p className="text-gray-600">${item.price} c/u</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => handleUpdateCartQuantity(item.id, e.target.value)}
                                                        className="w-20 border rounded px-2 py-1"
                                                    />
                                                    <button
                                                        onClick={() => handleRemoveFromCart(item.id)}
                                                        className="text-red-600 hover:text-red-700"
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                </div>
                                                <div className="font-bold">${(item.price * item.quantity).toFixed(2)}</div>
                                            </div>
                                        ))}
                                        <div className="text-right text-xl font-bold">
                                            Total: ${totalCart.toFixed(2)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Datos del Cliente */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h2 className="text-xl font-bold mb-4">Datos del Cliente</h2>
                                {!currentClient ? (
                                    showClientForm ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Nombre *</label>
                                                <input
                                                    type="text"
                                                    value={clientForm.name}
                                                    onChange={(e) => setClientForm({...clientForm, name: e.target.value})}
                                                    className="w-full border rounded px-3 py-2"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Cédula *</label>
                                                <input
                                                    type="text"
                                                    value={clientForm.cedula}
                                                    onChange={(e) => setClientForm({...clientForm, cedula: e.target.value})}
                                                    className="w-full border rounded px-3 py-2"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Dirección</label>
                                                <input
                                                    type="text"
                                                    value={clientForm.address}
                                                    onChange={(e) => setClientForm({...clientForm, address: e.target.value})}
                                                    className="w-full border rounded px-3 py-2"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Celular *</label>
                                                <input
                                                    type="tel"
                                                    value={clientForm.phone}
                                                    onChange={(e) => setClientForm({...clientForm, phone: e.target.value})}
                                                    className="w-full border rounded px-3 py-2"
                                                />
                                            </div>
                                            <div>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={clientForm.hasDeposit}
                                                        onChange={(e) => setClientForm({...clientForm, hasDeposit: e.target.checked})}
                                                    />
                                                    <span className="text-sm font-medium">¿Abonó?</span>
                                                </label>
                                            </div>
                                            {clientForm.hasDeposit && (
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">Monto Abono</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={clientForm.depositAmount}
                                                        onChange={(e) => setClientForm({...clientForm, depositAmount: e.target.value})}
                                                        className="w-full border rounded px-3 py-2"
                                                    />
                                                </div>
                                            )}
                                            <div>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={clientForm.hasCollateral}
                                                        onChange={(e) => setClientForm({...clientForm, hasCollateral: e.target.checked})}
                                                    />
                                                    <span className="text-sm font-medium">¿Dejó prenda?</span>
                                                </label>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleSaveClient}
                                                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                                >
                                                    Guardar
                                                </button>
                                                <button
                                                    onClick={() => setShowClientForm(false)}
                                                    className="flex-1 bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowClientForm(true)}
                                            className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700"
                                        >
                                            Registrar Cliente
                                        </button>
                                    )
                                ) : (
                                    <div className="space-y-2">
                                        <p><strong>Nombre:</strong> {currentClient.name}</p>
                                        <p><strong>Cédula:</strong> {currentClient.cedula}</p>
                                        <p><strong>Celular:</strong> {currentClient.phone}</p>
                                        {currentClient.address && <p><strong>Dirección:</strong> {currentClient.address}</p>}
                                        <p><strong>Abonó:</strong> {currentClient.hasDeposit ? `Sí - $${currentClient.depositAmount}` : 'No'}</p>
                                        <p><strong>Dejó prenda:</strong> {currentClient.hasCollateral ? 'Sí' : 'No'}</p>
                                        <button
                                            onClick={() => {
                                                setCurrentClient(null);
                                                setClientForm({
                                                    name: '',
                                                    cedula: '',
                                                    address: '',
                                                    phone: '',
                                                    hasDeposit: false,
                                                    hasCollateral: false,
                                                    depositAmount: ''
                                                });
                                            }}
                                            className="w-full mt-2 bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
                                        >
                                            Cambiar Cliente
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Fechas */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h2 className="text-xl font-bold mb-4">Fechas</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Fecha de Entrega *</label>
                                        <input
                                            type="date"
                                            value={rentalDates.deliveryDate}
                                            onChange={(e) => setRentalDates({...rentalDates, deliveryDate: e.target.value})}
                                            className="w-full border rounded px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Fecha de Devolución *</label>
                                        <input
                                            type="date"
                                            value={rentalDates.returnDate}
                                            onChange={(e) => setRentalDates({...rentalDates, returnDate: e.target.value})}
                                            className="w-full border rounded px-3 py-2"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleCompleteRental}
                                disabled={cart.length === 0 || !currentClient || !rentalDates.deliveryDate || !rentalDates.returnDate}
                                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold"
                            >
                                Completar Alquiler
                            </button>
                        </div>
                    </div>
                )}

                {/* Pestaña Alquileres */}
                {activeTab === 'rentals' && (
                    <div className="space-y-4">
                        {rentals.length === 0 ? (
                            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                                No hay alquileres registrados
                            </div>
                        ) : (
                            rentals.map(rental => (
                                <div key={rental.id} className="bg-white rounded-lg shadow p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold">{rental.client.name}</h3>
                                            <p className="text-gray-600">Cédula: {rental.client.cedula}</p>
                                            <p className="text-gray-600">Celular: {rental.client.phone}</p>
                                            {rental.client.address && <p className="text-gray-600">Dirección: {rental.client.address}</p>}
                                        </div>
                                        <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${rental.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {rental.status === 'active' ? 'Activo' : 'Devuelto'}
                      </span>
                                            <p className="text-sm text-gray-600 mt-2">
                                                ID: {rental.id}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-600">Fecha de Entrega</p>
                                            <p className="font-semibold">{rental.deliveryDate}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-600">Fecha de Devolución</p>
                                            <p className="font-semibold">{rental.returnDate}</p>
                                        </div>
                                    </div>

                                    <div className="border-t pt-4 mb-4">
                                        <h4 className="font-semibold mb-2">Artículos Alquilados</h4>
                                        <div className="space-y-2">
                                            {rental.items.map(item => (
                                                <div key={item.id} className="flex justify-between items-center">
                                                    <span>{item.name} x {item.quantity}</span>
                                                    <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="border-t pt-4 mb-4">
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            <div>
                                                <p className="text-sm font-medium text-gray-600">Total</p>
                                                <p className="text-xl font-bold text-blue-600">${rental.totalAmount.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-600">Pagado</p>
                                                <p className="text-xl font-bold text-green-600">${rental.paidAmount.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-600">Saldo</p>
                                                <p className="text-xl font-bold text-red-600">${rental.remainingAmount.toFixed(2)}</p>
                                            </div>
                                        </div>

                                        {rental.payments.length > 0 && (
                                            <div className="mb-4">
                                                <h4 className="font-semibold mb-2">Historial de Pagos</h4>
                                                <div className="space-y-2">
                                                    {rental.payments.map((payment, index) => (
                                                        <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                                            <div>
                                                                <span className="font-medium">${payment.amount.toFixed(2)}</span>
                                                                <span className="text-sm text-gray-600 ml-2">{payment.date}</span>
                                                                {payment.notes && <p className="text-sm text-gray-500">{payment.notes}</p>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <p className="text-sm text-gray-600">
                                                <strong>Abonó:</strong> {rental.client.hasDeposit ? 'Sí' : 'No'}
                                                {rental.client.hasDeposit && ` (${rental.client.depositAmount})`}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                <strong>Dejó prenda:</strong> {rental.client.hasCollateral ? 'Sí' : 'No'}
                                            </p>
                                        </div>
                                    </div>

                                    {rental.status === 'active' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedRental(rental);
                                                    setShowPaymentModal(true);
                                                }}
                                                className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center justify-center gap-2"
                                            >
                                                <DollarSign size={18} />
                                                Registrar Pago
                                            </button>
                                            <button
                                                onClick={() => handleReturnRental(rental.id)}
                                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                            >
                                                Marcar como Devuelto
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}

                        {showPaymentModal && selectedRental && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                                    <h2 className="text-xl font-bold mb-4">Registrar Pago</h2>
                                    <div className="mb-4">
                                        <p className="text-gray-600">Cliente: <strong>{selectedRental.client.name}</strong></p>
                                        <p className="text-gray-600">Saldo pendiente: <strong className="text-red-600">${selectedRental.remainingAmount.toFixed(2)}</strong></p>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Monto *</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={paymentForm.amount}
                                                onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                                                className="w-full border rounded px-3 py-2"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Fecha</label>
                                            <input
                                                type="date"
                                                value={paymentForm.date}
                                                onChange={(e) => setPaymentForm({...paymentForm, date: e.target.value})}
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Notas</label>
                                            <textarea
                                                value={paymentForm.notes}
                                                onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                                                className="w-full border rounded px-3 py-2"
                                                rows="3"
                                                placeholder="Notas adicionales..."
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-6">
                                        <button
                                            onClick={handleAddPayment}
                                            className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                        >
                                            Registrar
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowPaymentModal(false);
                                                setSelectedRental(null);
                                                setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
                                            }}
                                            className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
