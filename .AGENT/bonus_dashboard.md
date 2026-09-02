Esse dashboard trará para os representantes o quanto de bônus eles devem ganhar no período com base nos Students gerados por eles ou pelo WFE.

O bônus é dividido em 2 equipes:
### WorkForce Evolved (WFE):
Tem uma estrutura de bônus semanal com base na seguinte tabela:

| Students gerados | Rate per student |
|--------------------|------------------|
| 3 Students         | $5               |
| 5 Students         | $7.50            |
| 7 Students         | $10              |
| 9+ Students        | $15              |

Ao atingir a meta de 9+ students o representante receberá $100 de bônus

Esse bônus entra na conta de quem tem wfe = true em dRepresentative.

### TTPA
já no TTPA o bônus é dividido por Weekly Rate e Monthly Bonus:

Weekly Rate
| Students that Week | Rate for that Week |
|--------------------|--------------------|
| 0 Students         | No Bonus           |
| 1 Student          | $10 / Student      |
| 2 Students         | $30 / Student      |
| 3 Students         | $40 / Student      |
| 4+ Students        | $50 / Student      |

Monthly Bonus
| Total Students / Month | Bonus |
|------------------------|-------|
| 4 Students            | $40   |
| 6 Students            | $60   |
| 8 Students            | $80   |
| 10 Students           | $100  |

# DASHBOARD 1 - TTPA Bonus
Esse dashboard terá dados apenas dos representatives do TTPA
## Estrutura
### Filtros
- TTPA Representatives
- Month

### Linha 1: Dynamic Matrix TTPA
- Students x Weeks x Bonus
Ex:

|               | Week 1 | Week 2 | Week 3 | Week 4 | Total |
|---------------|--------|--------|--------|--------|-------|
| Students      |   3    |    4   |    1   |   2    |  10   |
| Weekly Bonus  |  $40   |  $50   |  $10   |  $40   |  $140 |
| Monthly Bonus |        |        |        |        |  $100 |
| Total Bonus   |        |        |        |        |  $240 |

obs: if dRepresentative.wfe = true, appers only if students > 0
obs2: Essa matriz precisa ser no formato como se fossem cards, com mais destaque nos números e visual moderno

### Linha 2: Gráficos Seletor de KPI e histórico
- Students x Weeks x Bonus
Ex:

|                 | Week 1 | Week 2 | Week 3 | Week 4 | Total |
|-----------------|--------|--------|--------|--------|-------|
| Students        |   9    |    4   |   10   |   3    |  26   |
| Weekly Bonus    |  $135  |  $20   |  $150  |  $15   |  $320 |
| Aditional Bonus |  $100  |        |  $100  |        |  $200 |
| Total Bonus     |        |        |        |        |  $520 |

obs: apenas if dRepresentative.wfe = true
obs2: Essa matriz precisa ser no formato como se fossem cards, com mais destaque nos números e visual moderno