package localstore

type DocEntry struct {
	ID            string   `json:"id"`
	Title         string   `json:"title"`
	Category      string   `json:"category"`
	Content       string   `json:"content"`
	SourceSession *string  `json:"sourceSession"`
	SourceAgent   *string  `json:"sourceAgent"`
	Keywords      []string `json:"keywords"`
	Language      string   `json:"language"`
	ExtractedAt   string   `json:"extractedAt"`
	UpdatedAt     string   `json:"updatedAt"`
}

func GetDocStore() *SliceStore[DocEntry] {
	return NewSliceStore[DocEntry]("docs.json")
}
