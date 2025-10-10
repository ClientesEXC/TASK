import React, { useState, useEffect } from 'react';
import { Calculator, FileText, Package, Layers, CircleDollarSign, Settings, Lock, Unlock } from 'lucide-react';

const ADMIN_PIN =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_COTIZADOR_PIN) ||
    (typeof process !== 'undefined' && process.env && process.env.REACT_APP_COTIZADOR_PIN) ||
    '1234';

const STORAGE_KEY = 'COTIZADOR_PRECIOS_V1';

const DEFAULT_PRECIOS = {
    // Diseñado (por m²)
    disenado: {
        PVC: 3,
        VINIL: 1.25,
        LONA: 0.98,
        ACRILICO: 14,
        MDF: 6
    },
    // Solo corte (por m²)
    soloCorte: {
        PVC: 7,
        VINIL: 10,
        ACRILICO: { '3mm': 30, '6mm': 55 },
        MDF: { '3mm': 12, '6mm': 18 }
    },
    // Diseño (coste fijo)
    diseno: {
        FACIL: 3,
        MEDIO: 5,
        DIFICIL: 8
    },
    // Extras (usados en cálculos)
    ojal: 0.75
};

const CotizadorMateriales = () => {
    // ======= Estado de precios (editable vía modal) =======
    const [precios, setPrecios] = useState(DEFAULT_PRECIOS);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setPrecios({ ...DEFAULT_PRECIOS, ...parsed }); // merge por si agregas nuevos campos en el futuro
            } catch (e) {
                // si falla, ignora y usa defaults
            }
        }
    }, []);

    // ======= Estados principales del cotizador =======
    const [tipoServicio, setTipoServicio] = useState('');
    const [materialesSeleccionados, setMaterialesSeleccionados] = useState([]);
    const [dimensiones, setDimensiones] = useState({});
    const [incluirImpresion, setIncluirImpresion] = useState(false);
    const [conDiseno, setConDiseno] = useState(false);
    const [nivelDiseno, setNivelDiseno] = useState('');
    const [ojales, setOjales] = useState({ incluir: false, cantidad: 0 });
    const [conCorteVinil, setConCorteVinil] = useState(false);
    const [conBasePVC, setConBasePVC] = useState(false);
    const [materialCorte, setMaterialCorte] = useState('');
    const [espesorCorte, setEspesorCorte] = useState('3mm');
    const [cotizacionFinal, setCotizacionFinal] = useState(null);

    // ======= Admin modal (protegido con PIN) =======
    const [showAdmin, setShowAdmin] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [tempPrecios, setTempPrecios] = useState(precios);

    useEffect(() => {
        if (showAdmin) {
            setTempPrecios(precios);
            setPinInput('');
            setIsUnlocked(false);
        }
    }, [showAdmin]); // al abrir modal, refresca

    const handleUnlock = () => {
        if (String(pinInput) === String(ADMIN_PIN)) {
            setIsUnlocked(true);
        } else {
            window.alert('PIN incorrecto');
        }
    };

    const handleSavePrecios = () => {
        setPrecios(tempPrecios);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tempPrecios));
        setShowAdmin(false);
        setIsUnlocked(false);
        setPinInput('');
    };

    const handleResetPrecios = () => {
        if (window.confirm('¿Restaurar valores por defecto?')) {
            setTempPrecios(DEFAULT_PRECIOS);
            localStorage.removeItem(STORAGE_KEY);
        }
    };

    // ======= Lógica de negocio existente =======
    const preciosDiseno = precios.diseno;
    const materialesConEspesor = ['ACRILICO', 'MDF'];

    const combinacionesPermitidas = [
        ['PVC', 'VINIL'],
        ['VINIL', 'PVC'],
        ['VINIL', 'ACRILICO'],
        ['ACRILICO', 'VINIL'],
        ['VINIL', 'MDF'],
        ['MDF', 'VINIL']
    ];

    const esCombinacionValida = (materiales) => {
        if (materiales.length === 1) return true;
        if (materiales.length !== 2) return false;
        return combinacionesPermitidas.some(
            (combo) =>
                (combo[0] === materiales[0] && combo[1] === materiales[1]) ||
                (combo[0] === materiales[1] && combo[1] === materiales[0])
        );
    };

    const handleMaterialChange = (material, espesor = null) => {
        if (tipoServicio === 'SOLO_CORTE') {
            setMaterialCorte(material);
            if (materialesConEspesor.includes(material)) setEspesorCorte(espesor || '3mm');
            return;
        }

        if (material === 'LONA') {
            setMaterialesSeleccionados(['LONA']);
            setDimensiones({ LONA: { ancho: '', alto: '', espesor: null } });
        } else {
            const nueva = [...materialesSeleccionados];
            const idx = nueva.findIndex((m) => m === material);
            if (idx > -1) {
                nueva.splice(idx, 1);
                const nuevasDim = { ...dimensiones };
                delete nuevasDim[material];
                setDimensiones(nuevasDim);
            } else {
                if (nueva.length < 2 && !nueva.includes('LONA')) {
                    nueva.push(material);
                    setDimensiones({
                        ...dimensiones,
                        [material]: { ancho: '', alto: '', espesor: espesor }
                    });
                }
            }
            if (esCombinacionValida(nueva)) setMaterialesSeleccionados(nueva);
        }
    };

    const handleDimensionChange = (material, tipo, valor) => {
        setDimensiones({
            ...dimensiones,
            [material]: {
                ...dimensiones[material],
                [tipo]: valor
            }
        });
    };

    const calcularCostoCorteVinil = () => {
        if (!dimensiones.VINIL) return 0;
        const area = parseFloat(dimensiones.VINIL.ancho || 0) * parseFloat(dimensiones.VINIL.alto || 0);
        if (area < 0.75) return 2;
        if (area <= 1.5) return 3;
        return 4;
    };

    const calcularCotizacion = () => {
        let costoTotal = 0;
        let detalles = [];

        if (tipoServicio === 'SOLO_CORTE') {
            const ancho = parseFloat(dimensiones[materialCorte]?.ancho || 0);
            const alto = parseFloat(dimensiones[materialCorte]?.alto || 0);
            const area = ancho * alto;

            let precioPorMetro = 0;
            if (materialesConEspesor.includes(materialCorte)) {
                precioPorMetro = precios.soloCorte[materialCorte][espesorCorte];
            } else {
                precioPorMetro = precios.soloCorte[materialCorte];
            }

            const costoMaterial = area * precioPorMetro;
            costoTotal = costoMaterial;

            detalles.push({
                concepto: `${materialCorte} ${materialesConEspesor.includes(materialCorte) ? espesorCorte : ''} - Solo Corte`,
                area: area.toFixed(2),
                precioPorMetro,
                costo: costoMaterial.toFixed(2)
            });
        } else {
            // ===== Diseñado =====
            // Materiales
            materialesSeleccionados.forEach((material) => {
                const dim = dimensiones[material];
                if (dim && dim.ancho && dim.alto) {
                    const area = parseFloat(dim.ancho) * parseFloat(dim.alto);
                    const precio = precios.disenado[material];
                    const costoMaterial = area * precio;
                    costoTotal += costoMaterial;
                    detalles.push({
                        concepto: `${material}${dim.espesor ? ' ' + dim.espesor : ''}`,
                        area: area.toFixed(2),
                        precioPorMetro: precio,
                        costo: costoMaterial.toFixed(2)
                    });
                }
            });

            // Diseño
            if (conDiseno && nivelDiseno) {
                const costoDiseno = preciosDiseno[nivelDiseno];
                costoTotal += costoDiseno;
                detalles.push({ concepto: `Diseño ${nivelDiseno}`, costo: costoDiseno.toFixed(2) });
            }

            // Ojales (solo Lona)
            if (materialesSeleccionados.includes('LONA') && ojales.incluir && ojales.cantidad > 0) {
                const costoOjales = ojales.cantidad * (precios.ojal ?? 0.75);
                costoTotal += costoOjales;
                detalles.push({ concepto: `Ojales (${ojales.cantidad} unidades)`, costo: costoOjales.toFixed(2) });
            }

            // Corte para vinil único
            if (materialesSeleccionados.length === 1 && materialesSeleccionados[0] === 'VINIL' && conCorteVinil) {
                const costoCorte = calcularCostoCorteVinil();
                costoTotal += costoCorte;
                detalles.push({ concepto: 'Corte de Vinil', costo: costoCorte.toFixed(2) });
            }

            // Base PVC para combinación PVC + VINIL
            const comboPVCVinil =
                materialesSeleccionados.includes('PVC') && materialesSeleccionados.includes('VINIL');
            if (comboPVCVinil && conBasePVC) {
                const areaVinil =
                    parseFloat(dimensiones['VINIL']?.ancho || 0) * parseFloat(dimensiones['VINIL']?.alto || 0);
                const precioPVC = precios.disenado.PVC;
                const costoBase = areaVinil * precioPVC;
                costoTotal += costoBase;
                detalles.push({
                    concepto: 'Base PVC',
                    area: areaVinil.toFixed(2),
                    precioPorMetro: precioPVC,
                    costo: costoBase.toFixed(2)
                });
            }
        }

        setCotizacionFinal({
            total: costoTotal.toFixed(2),
            detalles,
            incluirImpresion
        });
    };

    const resetearFormulario = () => {
        setTipoServicio('');
        setMaterialesSeleccionados([]);
        setDimensiones({});
        setIncluirImpresion(false);
        setConDiseno(false);
        setNivelDiseno('');
        setOjales({ incluir: false, cantidad: 0 });
        setConCorteVinil(false);
        setConBasePVC(false);
        setMaterialCorte('');
        setEspesorCorte('3mm');
        setCotizacionFinal(null);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-6xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <Calculator className="text-indigo-600" size={32} />
                            <h1 className="text-3xl font-bold text-gray-800">Sistema Cotizador de Materiales</h1>
                        </div>
                        <button
                            onClick={() => setShowAdmin(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50 font-semibold"
                            title="Modificar valores (PIN)"
                        >
                            <Settings size={18} />
                            Modificar valores
                        </button>
                    </div>

                    {/* Selección de tipo de servicio */}
                    {!tipoServicio && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                                <Package className="text-indigo-500" />
                                Seleccione el tipo de servicio
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => setTipoServicio('SOLO_CORTE')}
                                    className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all transform hover:scale-105 shadow-lg"
                                >
                                    <h3 className="text-xl font-bold mb-2">Solo Corte</h3>
                                    <p className="text-sm opacity-90">Servicio de corte sin diseño</p>
                                </button>
                                <button
                                    onClick={() => setTipoServicio('DISENADO')}
                                    className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
                                >
                                    <h3 className="text-xl font-bold mb-2">Diseñado</h3>
                                    <p className="text-sm opacity-90">Servicio completo con diseño</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Formulario SOLO CORTE */}
                    {tipoServicio === 'SOLO_CORTE' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                                <Layers className="text-indigo-500" />
                                Configuración - Solo Corte
                            </h2>

                            <div className="bg-gray-50 p-6 rounded-lg">
                                <h3 className="font-semibold text-gray-700 mb-4">Seleccione el material:</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {['PVC', 'ACRILICO', 'VINIL', 'MDF'].map((material) => (
                                        <div key={material} className="space-y-2">
                                            <button
                                                onClick={() => handleMaterialChange(material)}
                                                className={`w-full p-3 rounded-lg border-2 transition-all ${
                                                    materialCorte === material
                                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                        : 'border-gray-300 hover:border-indigo-300'
                                                }`}
                                            >
                                                {material}
                                            </button>
                                            {materialCorte === material && materialesConEspesor.includes(material) && (
                                                <select
                                                    value={espesorCorte}
                                                    onChange={(e) => setEspesorCorte(e.target.value)}
                                                    className="w-full p-2 border rounded-lg"
                                                >
                                                    <option value="3mm">3mm</option>
                                                    <option value="6mm">6mm</option>
                                                </select>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {materialCorte && (
                                <div className="bg-gray-50 p-6 rounded-lg">
                                    <h3 className="font-semibold text-gray-700 mb-4">Dimensiones del material:</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-600 mb-2">Ancho (metros)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={dimensiones[materialCorte]?.ancho || ''}
                                                onChange={(e) =>
                                                    setDimensiones({
                                                        [materialCorte]: { ...dimensiones[materialCorte], ancho: e.target.value }
                                                    })
                                                }
                                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-600 mb-2">Alto (metros)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={dimensiones[materialCorte]?.alto || ''}
                                                onChange={(e) =>
                                                    setDimensiones({
                                                        [materialCorte]: { ...dimensiones[materialCorte], alto: e.target.value }
                                                    })
                                                }
                                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Formulario DISEÑADO */}
                    {tipoServicio === 'DISENADO' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                                <Layers className="text-indigo-500" />
                                Configuración - Diseñado
                            </h2>

                            {/* Selección de materiales */}
                            <div className="bg-gray-50 p-6 rounded-lg">
                                <h3 className="font-semibold text-gray-700 mb-4">Seleccione los materiales (máximo 2, excepto Lona):</h3>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    {['PVC', 'ACRILICO', 'VINIL', 'LONA', 'MDF'].map((material) => (
                                        <div key={material} className="space-y-2">
                                            <button
                                                onClick={() => handleMaterialChange(material, '3mm')}
                                                disabled={
                                                    (material === 'LONA' && materialesSeleccionados.length > 0 && !materialesSeleccionados.includes('LONA')) ||
                                                    (material !== 'LONA' && materialesSeleccionados.includes('LONA')) ||
                                                    (materialesSeleccionados.length >= 2 && !materialesSeleccionados.includes(material))
                                                }
                                                className={`w-full p-3 rounded-lg border-2 transition-all ${
                                                    materialesSeleccionados.includes(material)
                                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                        : 'border-gray-300 hover:border-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed'
                                                }`}
                                            >
                                                {material}
                                            </button>
                                            {materialesSeleccionados.includes(material) && materialesConEspesor.includes(material) && (
                                                <select
                                                    value={dimensiones[material]?.espesor || '3mm'}
                                                    onChange={(e) => handleDimensionChange(material, 'espesor', e.target.value)}
                                                    className="w-full p-2 border rounded-lg"
                                                >
                                                    <option value="3mm">3mm</option>
                                                    <option value="6mm">6mm</option>
                                                </select>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {materialesSeleccionados.length === 2 && (
                                    <p className="mt-2 text-sm text-green-600">Combinación válida: {materialesSeleccionados.join(' + ')}</p>
                                )}
                            </div>

                            {/* Dimensiones */}
                            {materialesSeleccionados.length > 0 && (
                                <div className="bg-gray-50 p-6 rounded-lg">
                                    <h3 className="font-semibold text-gray-700 mb-4">Dimensiones de los materiales:</h3>
                                    {materialesSeleccionados.map((material) => (
                                        <div key={material} className="mb-4 p-4 bg-white rounded-lg">
                                            <h4 className="font-medium text-gray-700 mb-3">
                                                {material} {dimensiones[material]?.espesor ? `(${dimensiones[material].espesor})` : ''}
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-600 mb-2">Ancho (metros)</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={dimensiones[material]?.ancho || ''}
                                                        onChange={(e) => handleDimensionChange(material, 'ancho', e.target.value)}
                                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-600 mb-2">Alto (metros)</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={dimensiones[material]?.alto || ''}
                                                        onChange={(e) => handleDimensionChange(material, 'alto', e.target.value)}
                                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Opciones adicionales */}
                            {materialesSeleccionados.length > 0 && (
                                <div className="space-y-4">
                                    {/* Impresión */}
                                    <div className="bg-gray-50 p-6 rounded-lg">
                                        <label className="flex items-center space-x-3">
                                            <input
                                                type="checkbox"
                                                checked={incluirImpresion}
                                                onChange={(e) => setIncluirImpresion(e.target.checked)}
                                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                            />
                                            <span className="font-medium text-gray-700">Incluir impresión</span>
                                        </label>
                                    </div>

                                    {/* Diseño */}
                                    <div className="bg-gray-50 p-6 rounded-lg">
                                        <label className="flex items-center space-x-3 mb-4">
                                            <input
                                                type="checkbox"
                                                checked={conDiseno}
                                                onChange={(e) => setConDiseno(e.target.checked)}
                                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                            />
                                            <span className="font-medium text-gray-700">Incluir diseño</span>
                                        </label>
                                        {conDiseno && (
                                            <div className="grid grid-cols-3 gap-4 mt-4">
                                                {['FACIL', 'MEDIO', 'DIFICIL'].map((nivel) => (
                                                    <button
                                                        key={nivel}
                                                        onClick={() => setNivelDiseno(nivel)}
                                                        className={`p-3 rounded-lg border-2 transition-all ${
                                                            nivelDiseno === nivel
                                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                                : 'border-gray-300 hover:border-indigo-300'
                                                        }`}
                                                    >
                                                        {nivel} (${preciosDiseno[nivel]})
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Ojales para lona */}
                                    {materialesSeleccionados.includes('LONA') && (
                                        <div className="bg-gray-50 p-6 rounded-lg">
                                            <label className="flex items-center space-x-3 mb-4">
                                                <input
                                                    type="checkbox"
                                                    checked={ojales.incluir}
                                                    onChange={(e) => setOjales({ ...ojales, incluir: e.target.checked })}
                                                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                                />
                                                <span className="font-medium text-gray-700">Incluir ojales (${precios.ojal} c/u)</span>
                                            </label>
                                            {ojales.incluir && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-600 mb-2">Cantidad de ojales</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={ojales.cantidad}
                                                        onChange={(e) => setOjales({ ...ojales, cantidad: parseInt(e.target.value) || 0 })}
                                                        className="w-32 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Corte para vinil único */}
                                    {materialesSeleccionados.length === 1 && materialesSeleccionados[0] === 'VINIL' && (
                                        <div className="bg-gray-50 p-6 rounded-lg">
                                            <label className="flex items-center space-x-3">
                                                <input
                                                    type="checkbox"
                                                    checked={conCorteVinil}
                                                    onChange={(e) => setConCorteVinil(e.target.checked)}
                                                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                                />
                                                <span className="font-medium text-gray-700">Con corte de vinil</span>
                                            </label>
                                        </div>
                                    )}

                                    {/* Base PVC para combinación PVC-VINIL */}
                                    {materialesSeleccionados.includes('PVC') && materialesSeleccionados.includes('VINIL') && (
                                        <div className="bg-gray-50 p-6 rounded-lg">
                                            <label className="flex items-center space-x-3">
                                                <input
                                                    type="checkbox"
                                                    checked={conBasePVC}
                                                    onChange={(e) => setConBasePVC(e.target.checked)}
                                                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                                />
                                                <span className="font-medium text-gray-700">Con base PVC</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Botones de acción */}
                    {tipoServicio && (
                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={calcularCotizacion}
                                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                            >
                                <CircleDollarSign size={20} />
                                Calcular Cotización
                            </button>
                            <button
                                onClick={resetearFormulario}
                                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                            >
                                Reiniciar
                            </button>
                        </div>
                    )}

                    {/* Resultado */}
                    {cotizacionFinal && (
                        <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border-2 border-green-300">
                            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FileText className="text-green-600" />
                                Cotización Final
                            </h3>
                            <div className="space-y-3">
                                {cotizacionFinal.detalles.map((detalle, index) => (
                                    <div key={index} className="flex justify-between items-center py-2 border-b border-green-200">
                                        <div>
                                            <span className="font-medium text-gray-700">{detalle.concepto}</span>
                                            {detalle.area && (
                                                <span className="text-sm text-gray-500 ml-2">
                          ({detalle.area} m² × ${detalle.precioPorMetro}/m²)
                        </span>
                                            )}
                                        </div>
                                        <span className="font-semibold text-gray-800">${detalle.costo}</span>
                                    </div>
                                ))}
                                {cotizacionFinal.incluirImpresion && (
                                    <div className="text-sm text-blue-600 italic">* Incluye impresión (precio puede variar)</div>
                                )}
                                <div className="pt-4 border-t-2 border-green-400">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xl font-bold text-gray-800">TOTAL:</span>
                                        <span className="text-2xl font-bold text-green-600">${cotizacionFinal.total}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== Modal de administración ===== */}
                    {showAdmin && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center">
                            <div className="absolute inset-0 bg-black/40" onClick={() => setShowAdmin(false)} />
                            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <Settings className="text-indigo-600" />
                                        Modificar valores
                                    </h3>
                                    <button onClick={() => setShowAdmin(false)} className="text-gray-500 hover:text-gray-700">
                                        ✕
                                    </button>
                                </div>

                                {!isUnlocked ? (
                                    <div className="space-y-4">
                                        <p className="text-gray-600">Ingresa el PIN para editar precios.</p>
                                        <div className="flex gap-3">
                                            <input
                                                type="password"
                                                value={pinInput}
                                                onChange={(e) => setPinInput(e.target.value)}
                                                placeholder="PIN"
                                                className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <button
                                                onClick={handleUnlock}
                                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 inline-flex items-center gap-2"
                                            >
                                                <Unlock size={18} />
                                                Desbloquear
                                            </button>
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center gap-1">
                                            <Lock size={12} /> Usa VITE_COTIZADOR_PIN / REACT_APP_COTIZADOR_PIN (default 1234)
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6 max-h-[70vh] overflow-auto pr-2">
                                        {/* Diseñado */}
                                        <section>
                                            <h4 className="font-semibold text-gray-800 mb-3">Diseñado — precio por m²</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                {Object.keys(tempPrecios.disenado).map((mat) => (
                                                    <div key={mat} className="space-y-1">
                                                        <label className="text-sm text-gray-600">{mat}</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={tempPrecios.disenado[mat]}
                                                            onChange={(e) =>
                                                                setTempPrecios((p) => ({
                                                                    ...p,
                                                                    disenado: { ...p.disenado, [mat]: parseFloat(e.target.value || 0) }
                                                                }))
                                                            }
                                                            className="w-full p-2 border rounded-lg"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        {/* Solo corte */}
                                        <section>
                                            <h4 className="font-semibold text-gray-800 mb-3">Solo corte — precio por m²</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {/* PVC */}
                                                <div className="space-y-1">
                                                    <label className="text-sm text-gray-600">PVC</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={tempPrecios.soloCorte.PVC}
                                                        onChange={(e) =>
                                                            setTempPrecios((p) => ({
                                                                ...p,
                                                                soloCorte: { ...p.soloCorte, PVC: parseFloat(e.target.value || 0) }
                                                            }))
                                                        }
                                                        className="w-full p-2 border rounded-lg"
                                                    />
                                                </div>
                                                {/* VINIL */}
                                                <div className="space-y-1">
                                                    <label className="text-sm text-gray-600">VINIL</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={tempPrecios.soloCorte.VINIL}
                                                        onChange={(e) =>
                                                            setTempPrecios((p) => ({
                                                                ...p,
                                                                soloCorte: { ...p.soloCorte, VINIL: parseFloat(e.target.value || 0) }
                                                            }))
                                                        }
                                                        className="w-full p-2 border rounded-lg"
                                                    />
                                                </div>
                                                {/* ACRILICO 3/6 */}
                                                <div className="space-y-1">
                                                    <label className="text-sm text-gray-600">ACRÍLICO 3 mm</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={tempPrecios.soloCorte.ACRILICO['3mm']}
                                                        onChange={(e) =>
                                                            setTempPrecios((p) => ({
                                                                ...p,
                                                                soloCorte: {
                                                                    ...p.soloCorte,
                                                                    ACRILICO: { ...p.soloCorte.ACRILICO, '3mm': parseFloat(e.target.value || 0) }
                                                                }
                                                            }))
                                                        }
                                                        className="w-full p-2 border rounded-lg"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-sm text-gray-600">ACRÍLICO 6 mm</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={tempPrecios.soloCorte.ACRILICO['6mm']}
                                                        onChange={(e) =>
                                                            setTempPrecios((p) => ({
                                                                ...p,
                                                                soloCorte: {
                                                                    ...p.soloCorte,
                                                                    ACRILICO: { ...p.soloCorte.ACRILICO, '6mm': parseFloat(e.target.value || 0) }
                                                                }
                                                            }))
                                                        }
                                                        className="w-full p-2 border rounded-lg"
                                                    />
                                                </div>
                                                {/* MDF 3/6 */}
                                                <div className="space-y-1">
                                                    <label className="text-sm text-gray-600">MDF 3 mm</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={tempPrecios.soloCorte.MDF['3mm']}
                                                        onChange={(e) =>
                                                            setTempPrecios((p) => ({
                                                                ...p,
                                                                soloCorte: {
                                                                    ...p.soloCorte,
                                                                    MDF: { ...p.soloCorte.MDF, '3mm': parseFloat(e.target.value || 0) }
                                                                }
                                                            }))
                                                        }
                                                        className="w-full p-2 border rounded-lg"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-sm text-gray-600">MDF 6 mm</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={tempPrecios.soloCorte.MDF['6mm']}
                                                        onChange={(e) =>
                                                            setTempPrecios((p) => ({
                                                                ...p,
                                                                soloCorte: {
                                                                    ...p.soloCorte,
                                                                    MDF: { ...p.soloCorte.MDF, '6mm': parseFloat(e.target.value || 0) }
                                                                }
                                                            }))
                                                        }
                                                        className="w-full p-2 border rounded-lg"
                                                    />
                                                </div>
                                            </div>
                                        </section>

                                        {/* Botones modal */}
                                        <div className="flex justify-between pt-4">
                                            <button
                                                onClick={handleResetPrecios}
                                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                            >
                                                Restaurar por defecto
                                            </button>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => setShowAdmin(false)}
                                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={handleSavePrecios}
                                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
                                                >
                                                    Guardar cambios
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CotizadorMateriales;
