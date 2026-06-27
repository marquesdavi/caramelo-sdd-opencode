export const REQUIREMENTS_TEMPLATE = `
# Requirements Specification

## 1. Goal
[O que este feature vai resolver]

## 2. User Stories
- As a [role], I want [feature] so that [reason].

## 3. Acceptance Criteria
- [ ] WHEN [condition] THE SYSTEM SHALL [action]
`.trim();

export const BUGFIX_ANALYSIS_TEMPLATE = `
# Bug Analysis

## 1. Current Behavior (Defect)
- WHEN [condição] THE SYSTEM [comportamento incorreto]

## 2. Expected Behavior (Correction)
- WHEN [condição] THE SYSTEM SHALL [comportamento correto]

## 3. Unchanged Behavior (Regression Prevention)
- WHEN [condição] THE SYSTEM SHALL CONTINUE TO [comportamento que deve ser preservado]

## 4. Reproduction Steps
1. [Passo 1]
2. [Passo 2]
`.trim();

export const REFACTOR_REQUIREMENTS_TEMPLATE = `
# Refactor Specification

## 1. Discovery Interview
> Perguntas formuladas pelo agente com base na análise do pedido e do código.
> As respostas do humano foram registradas abaixo.

[Perguntas e respostas dinâmicas geradas pelo agente]

## 2. Goal
[Compilado pelo agente com base na Discovery Interview]

## 3. Current State (Antes)
[Análise do agente sobre a estrutura/padrão atual]

## 4. Target State (Depois)
[Estrutura/padrão desejado após a refatoração]

## 5. Behavioral Contract (NÃO QUEBRAR)
- [ ] WHEN [condição] THE SYSTEM SHALL CONTINUE TO [comportamento preservado]
`.trim();

export const DESIGN_TEMPLATE = `
# Design Specification

## 1. Architecture
[Explicação de alto nível dos componentes afetados]

## 2. Data Flow & Interfaces
[Diagrama Mermaid opcional]

## 3. Error Handling & Testing
[Como os erros serão tratados e estratégia de testes]
`.trim();

export const TASKS_TEMPLATE = `
# Execution Tasks

- [ ] Task 1: [Descrição da task atômica]
- [ ] Task 2: [Descrição da task atômica]
`.trim();

export const PRODUCT_STEERING_TEMPLATE = `
---
inclusion: always
---
# Product Overview
Defina aqui o propósito do produto, quem são os usuários e quais são os objetivos de negócio principais.
`.trim();

export const TECH_STEERING_TEMPLATE = `
---
inclusion: always
---
# Technology Stack
Liste as tecnologias usadas, frameworks e as ferramentas recomendadas.
`.trim();

export const STRUCTURE_STEERING_TEMPLATE = `
---
inclusion: always
---
# Project Structure
Documente o padrão arquitetural (ex: MVC, Clean Architecture), regras de nomenclatura de pastas e de arquivos.
`.trim();
