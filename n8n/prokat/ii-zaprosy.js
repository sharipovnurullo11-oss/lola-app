// Разбор фото «Без названия» через ИИ: по одному запросу на фото.
return ($input.first().json.guess || []).filter(g => g.url).map(g => ({ json: g }));
