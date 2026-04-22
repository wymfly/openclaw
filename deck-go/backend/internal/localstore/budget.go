package localstore

type BudgetRule struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Scope         string   `json:"scope"`
	AgentID       *string  `json:"agentId"`
	TaskID        *string  `json:"taskId"`
	Dimension     string   `json:"dimension"`
	WarnThreshold *float64 `json:"warnThreshold"`
	OverThreshold *float64 `json:"overThreshold"`
	Period        string   `json:"period"`
	Enabled       bool     `json:"enabled"`
	CreatedAt     string   `json:"createdAt"`
	UpdatedAt     string   `json:"updatedAt"`
}

func GetBudgetRuleStore() *SliceStore[BudgetRule] {
	return NewSliceStore[BudgetRule]("budget-rules.json")
}
