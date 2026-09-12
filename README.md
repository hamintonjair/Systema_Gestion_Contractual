# 🏛️ Sistema de Gestión Contractual - Alcaldía de Quibdó

![React](https://img.shields.io/badge/React-18.0-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.0-purple?logo=vite)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-3.8_Flash-orange?logo=google)
![Supabase](https://img.shields.io/badge/Supabase-Database-green?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0-cyan?logo=tailwind-css)

Una plataforma integral, moderna y segura diseñada para la modernización, radicación, auditoría y seguimiento de los **Informes Mensuales de Actividades**, **Cuentas de Cobro**, y el **Informe Final de Ejecución Contractual con Inteligencia Artificial** para los contratistas y supervisores de la **Alcaldía Municipal de Quibdó**.

---

## ✨ Módulos y Funcionalidades Principales

### 1. 👷‍♂️ Módulo para Contratistas (Dashboard Integral)
* **Diligenciamiento Guiado de Informes Mensuales:** Redacción estructurada de actividades ejecutadas por cada obligación contractual pactada.
* **Registro y Bitácora Fotográfica:** Carga y compresión en el navegador de hasta 5 fotografías probatorias por obligación con fecha y descripción.
* **Suite Documental para Cuenta de Cobro (7 Módulos en 1):**
  1. **Informe Mensual de Actividades:** Generación y exportación oficial en PDF y Word.
  2. **Certificado de Supervisión:** Emisión y cálculo automático para revisión del supervisor.
  3. **Soporte Fiduciaria:** Certificación bancaria y datos de desembolso fiduciario.
  4. **Declaración Juramentada de Renta:** Cumplimiento legal del Art. 3 Decreto 522/2003.
  5. **Autorización de Desembolso:** Documento equivalente a factura para personas naturales no comerciantes.
  6. **Orden de Documentos:** Checklist interactivo y guía paso a paso para radicación de cuenta de cobro.
  7. **Informe Final de Ejecución Contractual (IA):** Consolidación de todo el periodo contractual.
* **Auditoría y Corrección:** Visualización inmediata de observaciones puntuales casilla por casilla devueltas por el supervisor.
* **Notificaciones en Tiempo Real:** Avisos instantáneos de radicación, devolución o aprobación de informes.

### 2. 🤖 Módulo de Inteligencia Artificial (Google Gemini)
* **Consolidación Automática:** Analiza y agrupa todos los informes mensuales y obligaciones ejecutadas del contrato desde Supabase y almacenamiento local.
* **Alineación con el Plan de Desarrollo Municipal:** Cruza las actividades ejecutadas con las metas e indicadores del Plan de Desarrollo de Quibdó.
* **Redacción Técnica Profesional:** Genera introducción, metodología de intervención por zonas, cuadro consolidado de actividades por periodos, análisis técnico, impacto y recomendaciones.
* **Exportación Oficial a Word (.docx):** Genera el archivo editable con diseño institucional listo para firma y radicación.

### 3. 👩‍💼 Módulo para Supervisores y Secretarías
* **Auditoría Granular en Tiempo Real:** Aprobación o devolución de informes con comentarios específicos por campo u obligación.
* **Gestión de Dependencia:** Control consolidado de contratistas adscritos, estados de informes y fechas de radicación.
* **Firma y Validación:** Emisión ágil de certificados de cumplimiento a satisfacción.

### 4. 👑 Módulo Super Administrador
* **Gestión Global de Secretarías:** Creación, edición y administración de dependencias municipales y sus supervisores.
* **Directorio Maestro de Usuarios:** Control de roles, credenciales, contratos y asignaciones.
* **Panel de Configuración de IA (Google Gemini):**
  * Configuración institucional de API Key.
  * Selector de modelos activos: `gemini-3.8-flash` (Recomendado/Gratuito), `gemini-3.1-flash-lite`, `gemini-3.1-pro-preview`.
  * Herramienta de **Diagnóstico y Prueba de Conexión en Vivo**.
  * Visualizador y copiador del script SQL para Supabase en 1 clic.

---

## 🛠️ Arquitectura y Tecnologías

* **Frontend:** React 18 (Hooks y Componentes Funcionales) + TypeScript.
* **Estilos y Maquetación:** Tailwind CSS + Lucide React (iconografía).
* **Motor de Inteligencia Artificial:** `@google/genai` (Google Gen AI SDK oficial).
* **Base de Datos y Tiempo Real:** Supabase (PostgreSQL + Row Level Security + Realtime).
* **Persistencia Híbrida:** Sincronización en la nube con respaldo y caché en `localStorage` tolerante a fallos de red.
* **Generación Documental:**
  * `docx`: Motor de construcción y exportación a Microsoft Word (.docx).
  * `jspdf` + `html2canvas`: Motor de renderizado e impresión en PDF.
  * `browser-image-compression`: Optimización de imágenes en el cliente antes de la carga.

---

## 🗄️ Esquema de Base de Datos (Supabase / PostgreSQL)

El sistema opera sobre las siguientes tablas en Supabase:

1. **`secretarias`**: Dependencias de la Alcaldía de Quibdó (código, nombre, NIT).
2. **`usuarios`**: Perfiles de usuarios (SuperAdmin, Supervisores de Secretaría, Contratistas).
3. **`informes_mensuales`**: Informes radicados, periodos, valores, obligaciones y estados.
4. **`comentarios_campos`**: Observaciones de auditoría por casilla específica.
5. **`notificaciones`**: Alertas institucionales para contratistas y supervisores.
6. **`configuracion_ia`**: API Key y modelo de Google Gemini activo a nivel municipal.
7. **`informes_finales`**: Consolidado técnico, cuadro de actividades y metas del Plan de Desarrollo.

### Scripts de Migración SQL
El esquema base está en `/supabase/schema.sql`. Las migraciones incrementales
se encuentran en `/supabase/migrations/`:
* `informes_finales_y_configuracion_schema.sql` (Tablas de IA e Informes Finales)
* `notifications_schema.sql` (Tabla de Notificaciones)
* `add_fiduciaria_table.sql` / `add_fiduciaria_rls.sql` (Tabla y políticas de Soporte Fiduciaria)

---

## 🚀 Instalación y Ejecución Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/alcaldia-gestion-contractual.git
   cd alcaldia-gestion-contractual
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Variables de Entorno (`.env`):**
   Crea un archivo `.env` en la raíz del proyecto:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_clave_anon_publica
   GEMINI_API_KEY=tu_api_key_de_google_ai_studio
   ```

4. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Disponible en `http://localhost:3000`.

5. **Compilación para Producción:**
   ```bash
   npm run build
   ```

---

## ☁️ Despliegue en Producción (Render / Cloud Run / Vercel)

La aplicación está optimizada para ser desplegada como Single Page Application (SPA).

* **Build Command:** `npm run build`
* **Publish Directory:** `dist`
* **Regla de Reescritura (SPA Rewrite):** Redirigir todas las rutas `/*` a `/index.html` para soportar navegación del lado del cliente sin errores 404 al recargar.

---

*Desarrollado para la Alcaldía Municipal de Quibdó — Fortaleciendo la transparencia, la innovación tecnológica y la eficiencia en la gestión pública.*
