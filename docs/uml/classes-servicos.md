# Diagrama de classes (serviços centrais)

Serviços que concentram as regras de moedas, sequência, conclusão de planos e resgates, e as entidades que eles gravam. `CoinLedger` é o único caminho que altera moedas (RN10); `StreakService` e `PlanCompletionService` pagam bônus por ele; `RedemptionsService` debita e estorna por ele (RN11 e RN12).

![Diagrama de classes (serviços centrais)](classes-servicos.png)

```mermaid
classDiagram
  direction LR

  class CoinLedger {
    <<service>>
    +credit(tx, movement)
    +debit(tx, movement)
  }
  class StreakService {
    <<service>>
    +register(tx, studentId, now)
    +effective(profile, now)
  }
  class PlanCompletionService {
    <<service>>
    +load(studentId, planId)
    +settle(studentId, planId)
    +settleInTx(tx, studentId, planId)
  }
  class RedemptionsService {
    <<service>>
    +redeem(user, rewardId)
    +deliver(id, user)
    +reject(id, dto, user)
  }
  class AnswersService {
    <<service>>
    +answer(user, dto)
    +stats(user)
  }

  class StudentProfile
  class CoinTransaction
  class PlanCompletion
  class ChapterCompletion
  class RewardRedemption
  class Reward

  AnswersService ..> CoinLedger : usa
  AnswersService ..> StreakService : usa
  AnswersService ..> PlanCompletionService : usa
  PlanCompletionService ..> CoinLedger : paga o bônus
  StreakService ..> CoinLedger : paga o bônus de 7 dias
  RedemptionsService ..> CoinLedger : débito e estorno
  CoinLedger ..> CoinTransaction : grava
  CoinLedger ..> StudentProfile : atualiza o saldo
  RedemptionsService ..> RewardRedemption : gerencia
  RedemptionsService ..> Reward : baixa e devolve estoque
  PlanCompletionService ..> PlanCompletion : grava
  PlanCompletionService ..> ChapterCompletion : grava
  StreakService ..> StudentProfile : atualiza a sequência
```
