package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.common.PageResult;
import org.springframework.transaction.annotation.Transactional;

/** El agente ve sus propiedades en todos los estados. */
public class ListAgentPropertiesHandler {

    private final PropertyReadModel readModel;

    public ListAgentPropertiesHandler(PropertyReadModel readModel) {
        this.readModel = readModel;
    }

    @Transactional(readOnly = true)
    public PageResult<PropertySummaryView> handle(ListAgentPropertiesQuery query) {
        return readModel.listByAgent(query.agentId(), query.status(), query.page());
    }
}
