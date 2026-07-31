from rest_framework.pagination import PageNumberPagination


class EduStockPagination(PageNumberPagination):
    """Paginação uniforme para cadastros e históricos administrativos."""

    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 500
