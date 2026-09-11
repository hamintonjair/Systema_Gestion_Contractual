# 🏛️ Sistema de Gestión Contractual - Alcaldía de Quibdó

![React](https://img.shields.io/badge/React-18.0-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-4.0-purple?logo=vite)
![Supabase](https://img.shields.io/badge/Supabase-Database-green?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0-cyan?logo=tailwind-css)

Una plataforma integral y segura diseñada para la modernización, diligenciamiento, y seguimiento de los **Informes Mensuales de Actividades** y **Obligaciones Contractuales** de los contratistas de la Alcaldía de Quibdó. 

Este sistema elimina el uso excesivo de papel, automatiza la validación de reportes, mejora la trazabilidad documental y permite a los supervisores auditar eficientemente la ejecución de los recursos públicos.

---

## ✨ Características Principales

### 👷‍♂️ Módulo para Contratistas
*   **Diligenciamiento Guiado:** Interfaz intuitiva para redactar actividades por cada obligación contractual.
*   **Gestión Fotográfica:** Carga, compresión en el navegador (para ahorrar datos) y asociación de hasta 5 fotografías probatorias por obligación.
*   **Autoguardado y Tolerancia a Fallos:** Sincronización continua en `localStorage` combinada con copias en la nube (Supabase) para evitar pérdida de datos si se pierde la conexión.
*   **Suite Documental:** Autogeneración en PDF de Planilla de Seguridad Social, Declaración Juramentada, y Soportes de Fiduciaria.
*   **Corrección de Observaciones:** Visualización de comentarios de rechazo a nivel de campo específico (casilla por casilla) hechos por la supervisión.

### 👩‍💼 Módulo para Supervisores (Secretarías)
*   **Panel de Control (Dashboard):** Vista general de los informes recibidos, en revisión, aprobados y pendientes de firmas.
*   **Auditoría Granular:** Capacidad de devolver informes dejando observaciones específicas directamente sobre las obligaciones, fechas o montos que presentan inconsistencias.
*   **Certificación Automática:** Emisión y firma digital de los **Certificados de Supervisión**, Autorizaciones de Desembolso y Soportes de Liquidación.
*   **Gestión de Contratos:** Control de prorrogas, adiciones, CDP, CRP y vigencia de pólizas de los contratistas a cargo.

### ⚙️ Características del Sistema
*   **Generador PDF Nativo:** Conversión precisa de las vistas HTML a documentos PDF con membretes oficiales y diseño institucional listo para radicación, sin depender de costosos servicios de terceros.
*   **Autenticación y Roles (RBAC):** Accesos diferenciados para Super Administradores, Administradores de Secretaría y Contratistas.

---

## 🛠️ Arquitectura y Tecnologías

*   **Frontend Core:** React 18 (Funcional) + TypeScript.
*   **Build Tool:** Vite (Optimizado para tiempos de compilación rápidos).
*   **Estilos y UI:** Tailwind CSS (Mobile-first, utilitario) y Lucide React (Iconografía).
*   **Backend as a Service (BaaS):** Supabase.
    *   *PostgreSQL:* Modelado de datos relacional (Contratos, Informes, Obligaciones, Usuarios).
    *   *Storage:* Almacenamiento seguro de anexos fotográficos.
*   **Procesamiento de Archivos:**
    *   `browser-image-compression`: Reducción del peso de las imágenes antes de enviarlas al servidor.
    *   `jspdf` y `html2canvas`: Motor de renderizado PDF en el lado del cliente.

---

## 📂 Estructura del Proyecto

```text
src/
├── components/          # Componentes reutilizables de UI y vistas modulares (Dashboards, Editores)
├── services/            # Lógica de negocio y conexión con APIs (SupabaseService)
├── utils/               # Funciones de ayuda (formateo de fechas, moneda, cálculos de liquidación)
├── App.tsx              # Punto de entrada principal y enrutador de vistas por roles
├── types.ts             # Definición estricta de interfaces y tipos de TypeScript
└── index.css            # Archivo global de estilos Tailwind
```

---

## 🚀 Instalación y Desarrollo Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/alcaldia-gestion-contractual.git
   cd alcaldia-gestion-contractual
   ```

2. **Instalar las dependencias:**
   ```bash
   npm install
   ```

3. **Configurar las Variables de Entorno:**
   Crea un archivo `.env` en la raíz del proyecto. Deberás enlazarlo con tu proyecto de Supabase:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_clave_anon_publica
   ```

4. **Iniciar el Servidor de Desarrollo:**
   ```bash
   npm run dev
   ```
   El proyecto estará disponible en `http://localhost:3000`.

---

## ☁️ Guía de Despliegue en Render (Producción)

Esta aplicación está optimizada para ser desplegada como un **Static Site** (Sitio Estático) en plataformas modernas como Render, Vercel o Netlify.

Si utilizas [Render.com](https://render.com/), configura tu servicio Web Estático de la siguiente manera:

1. Conecta este repositorio de GitHub.
2. **Build Command:** 
   ```bash
   npm install && npm run build
   ```
3. **Publish directory:** 
   ```text
   dist
   ```
4. **Environment Variables:**
   Añade las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en la configuración de Render.

### ⚠️ Regla de Redirección (Crucial para SPA)
Dado que React Router o la navegación interna en Single Page Applications maneja el ruteo del lado del cliente, debes configurar una regla de reescritura para evitar el error `404 Not Found` al recargar la página.

En el panel de tu proyecto en Render, ve a la pestaña **Redirects/Rewrites** y agrega:
*   **Source:** `/*`
*   **Destination:** `/index.html`
*   **Action:** `Rewrite` (Reescritura, no redirección).

---
*Desarrollado para promover la transparencia, la seguridad de la información y la eficiencia administrativa en la gestión pública.*
