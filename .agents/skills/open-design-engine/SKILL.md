---
name: open-design-engine
description: >-
  OpenDesign Engine & Design System Auditor (ported from nexu-io/open-design).
  Applies enterprise design systems, anti-AI-slop design rules, refined typography,
  micro-interactions, and high-fidelity dashboard interfaces for web applications.
triggers:
  - "open design"
  - "redesign UI"
  - "polish dashboard"
  - "enterprise design system"
  - "anti-ai-slop"
---

# OpenDesign Engine & Design Standards

مستوحى ومستخلص من مستودع ومحرك **OpenDesign** (`nexu-io/open-design`):

## 1. مبادئ مكافحة القوالب النمطية (Anti-AI-Slop Protocol)
- **تجنب تدرجات الذكاء الاصطناعي الشائعة (Purple/Blue AI Gradients):** استخدام لوحة ألوان دقيقة ترتكز على ألوان الهوية المؤسسية (Deep Navy, Slate Blue, Teal, Emerald) بظلال متناسقة.
- **الهرمية الخطية الواضحة (Typography Hierarchy):**
  - استخدام خط `Cairo` بأوزان متعددة ومتناسقة (400 للفقرات، 500 للتسميات، 600 للعناوين الفرعية، 700 و800 للعناوين البارزة والأرقام).
  - تفعيل `font-variant-numeric: tabular-nums` في جميع الأرقام والـ KPIs والجداول لمنع اهتزاز الأرقام وضمان المحاذاة العمودية.
- **الأسطح والظلال المتدرجة الطبيعية (Toned Surfaces & Colored Shadows):**
  - منع الظلال السوداء الخام `rgba(0,0,0,0.15)`. استخدام ظلال مشبعة بلون الخلفية أو العنصر `rgba(13, 71, 161, 0.08)`.
  - تطبيق تأثيرات الزجاج التفاعلي (Backdrop Filter Blur) مع حدود دقيقة شبه شفافة (`border: 1px solid rgba(255,255,255,0.6)` أو `rgba(13,71,161,0.12)`).

## 2. معمارية شبكة Bento ونظم التحكم (Bento Grid & Mission Control)
- **كروت KPIs تفاعلية:**
  - كل كارت يحتوي على وعاء أيقونة زجاجي ملون، مؤشر رقمي بارز، وحالة تفاعلية عند التحويم مع تأثير رفع ثلاثي الأبعاد خفيف (`translateY(-2px)`).
- **ألسنة التبويب والفلاتر التفاعلية (Active Pill Indicators):**
  - أزرار الفلترة تعتمد على حواف ناعمة وكبسولات تمنح المستخدم تغذية راجعة فورية عند النقر، مع عرض عدد السجلات داخل شارة صغيرة.
- **لوحة القيادة المكانية (Spatial Command Center):**
  - شريط تحكم عائم زجاجي لطبقات KMZ مدمج أعلى الخريطة.
  - بطاقة استخبارات النطاق (Zone Intelligence Card) تظهر بتأثير انزلاق ناعم (Fade & Slide in) مع توزيع مرئي دقيق للبيانات الفنية.

## 3. تكامل الجداول والشارتات المؤسسية (Enterprise Tables & Charts)
- **رأس جدول مثبت (Sticky Header):** خلفية بلون Slate ناعم مع حدود خفيفة وأرقام متراصة.
- **شارات الحالات (Status Badges):** شارات مصممة بألوان هادئة عالية التباين ومعتمدة للطباعة والعرض المكتبي والميداني.
- **شارتات Chart.js ذات تدرجات لونية ناعمة:** حواف دائرية للأعمدة وخطوط شبكية هادئة.
