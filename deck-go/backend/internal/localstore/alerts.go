package localstore

type AlertRule struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	EntityType  string   `json:"entityType"`
	Condition   string   `json:"condition"`
	Threshold   float64  `json:"threshold"`
	Action      string   `json:"action"`
	CooldownMs  float64  `json:"cooldownMs"`
	LastFiredAt *string  `json:"lastFiredAt"`
	Enabled     bool     `json:"enabled"`
	CreatedAt   string   `json:"createdAt"`
	UpdatedAt   string   `json:"updatedAt"`
}

func GetAlertRuleStore() *SliceStore[AlertRule] {
	return NewSliceStore[AlertRule]("alert-rules.json")
}
